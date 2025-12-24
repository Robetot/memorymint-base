import { useState, useCallback, useRef, useEffect } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult, decodeFunctionResult, decodeEventLog, formatEther, formatUnits, maxUint256 } from 'viem';

// ============ CONFIGURATION ============
const NFT_CONTRACT_ADDRESS = '0xBf44A549C390923fD00B17E867804355E93Bf4c0';

// Base Mainnet USDC address
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

// Base Mainnet Chain ID
const BASE_CHAIN_ID = '0x2105'; // 8453

// RPC endpoints for reading contract state
const RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.meowrpc.com',
];

// Coinbase Paymaster URL for Base Mainnet
const COINBASE_PAYMASTER_URL = 'https://api.developer.coinbase.com/rpc/v1/base/paymaster';

// Payment token types
export type PaymentToken = 'ETH' | 'USDC';

// ============ CONTRACT ABI ============
const CONTRACT_ABI = parseAbi([
  // ETH payment functions
  'function mintNFT(string tokenURI) payable returns (uint256)',
  'function mintWithSignature(string tokenURI, uint256 expiration, bytes signature) payable returns (uint256)',
  'function batchMint(uint256 quantity) payable returns (uint256)',
  // USDC payment functions
  'function mintWithUSDC(string tokenURI) returns (uint256)',
  'function batchMintWithUSDC(uint256 quantity) returns (uint256)',
  // Bonus claim functions
  'function claimBonus(uint256 levelId, uint256 gameLevel, bytes levelProof) external',
  'function claimBonusAsUSDC(uint256 levelId, uint256 gameLevel, bytes levelProof) external',
  // Price getters
  'function mintPriceUSDC() view returns (uint256)',
  'function getMintPriceETH() view returns (uint256)',
  'function getBatchMintPriceETH(uint256 quantity) view returns (uint256)',
  'function getBatchMintPriceUSDC(uint256 quantity) view returns (uint256)',
  'function getEthUsdPrice() view returns (uint256)',
  // Bonus getters
  'function getBonusAmountETH(uint256 levelId) view returns (uint256)',
  'function getBonusAmountUSDC(uint256 levelId) view returns (uint256)',
  'function canClaimBonus(address user, uint256 levelId) view returns (bool, string)',
  'function getBonusLevel(uint256 levelId) view returns (uint256, bool, uint256, uint256, bool)',
  'function bonusLevels(uint256 levelId) view returns (uint256, bool, uint256, uint256, bool, uint8)',
  'function owner() view returns (address)',
  // Admin toggle states
  'function mintEnabled() view returns (bool)',
  'function claimEnabled() view returns (bool)',
  'function activePaymentToken() view returns (uint8)',
  'function getDisabledReason() view returns (string)',
  'function sponsoredMintEnabled() view returns (bool)',
  // Anti-bot
  'function mintCooldown() view returns (uint256)',
  'function lastMintTime(address) view returns (uint256)',
  'function walletMintCount(address) view returns (uint256)',
  'function maxMintsPerWallet() view returns (uint256)',
]);

// ERC20 ABI for USDC
const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

// ERC721 Transfer event for token ID extraction
const ERC721_TRANSFER_EVENT = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ],
} as const;

// Custom errors
const CONTRACT_ERROR_ABI = parseAbi([
  'error NotOwner()',
  'error ZeroAddress()',
  'error TokenNotExist()',
  'error NotApproved()',
  'error InvalidQuantity()',
  'error MaxBatchExceeded()',
  'error TransferToNonReceiver()',
  'error InsufficientPayment()',
  'error InsufficientUSDCAllowance()',
  'error WithdrawFailed()',
  'error ClaimNotActive()',
  'error AlreadyClaimed()',
  'error NotEligible()',
  'error InvalidLevelProof()',
  'error OracleStalePrice()',
  'error OracleInvalidPrice()',
  'error OracleNotSet()',
  'error MintDisabled()',
  'error ClaimDisabled()',
  'error CooldownActive()',
  'error MintCapReached()',
]);

// ============ TYPES ============
export interface AdminConfig {
  mintEnabled: boolean;
  claimEnabled: boolean;
  activePaymentToken: PaymentToken;
  sponsoredMintEnabled: boolean;
  disabledReason: string | null;
  lastFetched: number;
  isLoaded: boolean;
}

export interface AntiBotConfig {
  cooldown: bigint;
  lastMintTime: bigint;
  mintCount: bigint;
  maxMints: bigint;
  canMintNow: boolean;
  cooldownRemaining: bigint;
}

export interface MintState {
  isMinting: boolean;
  isClaiming: boolean;
  txHash: string | null;
  tokenId: string | null;
  tokenIds: string[] | null;
  error: string | null;
  success: boolean;
  isSponsored: boolean;
  mintPriceEth: string | null;
  mintPriceUSDC: string | null;
  selectedPaymentToken: PaymentToken;
  adminConfig: AdminConfig;
  antiBotConfig: AntiBotConfig | null;
  isLoadingConfig: boolean;
}

export interface PriceInfo {
  ethPrice: bigint;
  mintPriceUSDC: bigint;
  mintPriceETH: bigint;
  mintPriceUSDCFormatted: string;
  mintPriceETHFormatted: string;
  isFree: boolean;
}

export interface BalanceCheck {
  hasEnough: boolean;
  balance: string;
  required: string;
  shortfall: string | null;
  token: PaymentToken;
}

// ============ FAIL-CLOSED DEFAULTS ============
const FAIL_CLOSED_ADMIN_CONFIG: AdminConfig = {
  mintEnabled: false,
  claimEnabled: false,
  activePaymentToken: 'ETH',
  sponsoredMintEnabled: false,
  disabledReason: 'Admin configuration unavailable',
  lastFetched: 0,
  isLoaded: false,
};

// ============ HELPER FUNCTIONS ============
function formatWeiToEth(wei: bigint): string {
  return formatEther(wei);
}

function formatUSDCAmount(amount: bigint): string {
  return `$${formatUnits(amount, USDC_DECIMALS)}`;
}

function decodeMintError(error: unknown): string {
  const err: any = error;

  if (err?.code === 4001) return 'Transaction rejected by user';

  const revertData: unknown =
    err?.data?.data ?? err?.data ?? err?.error?.data?.data ?? err?.error?.data;

  if (typeof revertData === 'string' && revertData.startsWith('0x')) {
    try {
      const decoded = decodeErrorResult({
        abi: CONTRACT_ERROR_ABI,
        data: revertData as `0x${string}`,
      });

      switch (decoded.errorName) {
        case 'InsufficientPayment': return 'Insufficient payment. Please ensure you have enough ETH.';
        case 'InvalidQuantity':
        case 'MaxBatchExceeded': return 'Batch size must be 1–10';
        case 'TransferToNonReceiver': return 'Recipient cannot receive ERC-721 tokens';
        case 'NotOwner': return 'Not authorized';
        case 'MintDisabled': return 'Minting is currently disabled by admin';
        case 'ClaimDisabled': return 'Claiming is currently disabled by admin';
        case 'CooldownActive': return 'Please wait before minting again';
        case 'MintCapReached': return 'Wallet mint limit reached';
        case 'AlreadyClaimed': return 'Bonus already claimed for this level';
        case 'NotEligible': return 'Not eligible to claim this bonus';
        case 'OracleStalePrice':
        case 'OracleInvalidPrice':
        case 'OracleNotSet': return 'Price feed temporarily unavailable. Please try again.';
        default: return `Transaction failed: ${decoded.errorName}`;
      }
    } catch { /* fall through */ }
  }

  const rawMsg: string | undefined = err?.data?.message || err?.error?.message || err?.message;
  if (rawMsg) {
    if (rawMsg.toLowerCase().includes('oracle') || rawMsg.toLowerCase().includes('price feed')) {
      return 'Price feed temporarily unavailable. Please try again.';
    }
    if (rawMsg.includes('insufficient funds')) return 'Insufficient ETH balance for transaction';
    if (rawMsg.includes('gas required exceeds')) return 'Transaction would fail. Please check your balance.';
    if (rawMsg.includes('cooldown')) return 'Please wait before minting again';
    if (rawMsg.includes('disabled')) return 'Feature is currently disabled by admin';
    return rawMsg.slice(0, 100);
  }
  return 'Transaction failed. Please try again.';
}

function supportsWalletSendCalls(): boolean {
  const ethereum = window.ethereum as any;
  if (!ethereum) return false;
  return !!(ethereum.isSmartWallet || ethereum.isPasskeyWallet || ethereum.isCoinbaseWallet);
}

async function rpcCall(method: string, params: any[]): Promise<any> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (data.error) continue;
      return data.result;
    } catch { continue; }
  }
  throw new Error('All RPC endpoints failed');
}

// ============ MAIN HOOK ============
export function useNFTMint() {
  const [mintState, setMintState] = useState<MintState>({
    isMinting: false,
    isClaiming: false,
    txHash: null,
    tokenId: null,
    tokenIds: null,
    error: null,
    success: false,
    isSponsored: false,
    mintPriceEth: null,
    mintPriceUSDC: null,
    selectedPaymentToken: 'ETH',
    adminConfig: FAIL_CLOSED_ADMIN_CONFIG,
    antiBotConfig: null,
    isLoadingConfig: true,
  });
  
  // Issue #1: Split oracle locks by token type
  const pendingEthPriceRef = useRef<boolean>(false);
  const pendingUsdcPriceRef = useRef<boolean>(false);
  const pendingAdminConfigRef = useRef<boolean>(false);
  
  // Issue #8: Simplified boolean lock for pending mint
  const pendingMintRef = useRef<boolean>(false);
  
  // Network switch tracking
  const currentChainRef = useRef<string | null>(null);
  const isNetworkSwitchingRef = useRef<boolean>(false);

  // ============ SAFE RPC WRAPPER ============
  const safeRpcCall = useCallback(async <T>(
    call: () => Promise<T>,
    pendingRef: React.MutableRefObject<boolean>,
    errorDefault?: T
  ): Promise<T> => {
    if (pendingRef.current) {
      throw new Error('Operation in progress. Please wait.');
    }
    
    pendingRef.current = true;
    try {
      return await call();
    } catch (error) {
      if (errorDefault !== undefined) return errorDefault;
      throw error;
    } finally {
      pendingRef.current = false;
    }
  }, []);

  // ============ ABI DECODE HELPER ============
  const decodeUint256Result = useCallback((result: string, functionName: string): bigint => {
    if (!result || result === '0x') {
      throw new Error(`Empty response from ${functionName}`);
    }
    
    try {
      const decoded = decodeFunctionResult({
        abi: CONTRACT_ABI,
        functionName: functionName as any,
        data: result as `0x${string}`,
      });
      return decoded as bigint;
    } catch (error) {
      console.error(`[Decode] Failed to decode ${functionName}:`, error);
      throw new Error(`Failed to decode ${functionName} response`);
    }
  }, []);

  // ============ FETCH ADMIN CONFIG ============
  const fetchAdminConfig = useCallback(async (force = false): Promise<AdminConfig> => {
    return safeRpcCall(async () => {
      const calls = [
        { fn: 'mintEnabled', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'mintEnabled', data: r as `0x${string}` }) as boolean },
        { fn: 'claimEnabled', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'claimEnabled', data: r as `0x${string}` }) as boolean },
        { fn: 'activePaymentToken', decode: (r: string) => (decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'activePaymentToken', data: r as `0x${string}` }) as number) === 1 ? 'USDC' : 'ETH' },
        { fn: 'sponsoredMintEnabled', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'sponsoredMintEnabled', data: r as `0x${string}` }) as boolean },
        { fn: 'getDisabledReason', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'getDisabledReason', data: r as `0x${string}` }) as string },
      ];

      const results = await Promise.allSettled(
        calls.map(async ({ fn }) => {
          const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: fn as any, args: [] });
          const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
          return { fn, result };
        })
      );

      const mintResult = results[0];
      const claimResult = results[1];
      
      if (mintResult.status === 'rejected' || claimResult.status === 'rejected') {
        console.error('[AdminConfig] Critical config call failed');
        return FAIL_CLOSED_ADMIN_CONFIG;
      }

      try {
        const mintEnabled = calls[0].decode((mintResult as PromiseFulfilledResult<{ fn: string; result: string }>).value.result) as boolean;
        const claimEnabled = calls[1].decode((claimResult as PromiseFulfilledResult<{ fn: string; result: string }>).value.result) as boolean;
        
        let activePaymentToken: PaymentToken = 'ETH';
        let sponsoredMintEnabled = false;
        let disabledReason: string | null = null;

        if (results[2].status === 'fulfilled') {
          try {
            const tokenResult = calls[2].decode((results[2] as PromiseFulfilledResult<{ fn: string; result: string }>).value.result);
            activePaymentToken = tokenResult as PaymentToken;
          } catch { /* use default */ }
        }

        if (results[3].status === 'fulfilled') {
          try {
            const sponsoredResult = calls[3].decode((results[3] as PromiseFulfilledResult<{ fn: string; result: string }>).value.result);
            sponsoredMintEnabled = sponsoredResult as boolean;
          } catch { /* use default */ }
        }

        if (results[4].status === 'fulfilled') {
          try {
            const reasonResult = calls[4].decode((results[4] as PromiseFulfilledResult<{ fn: string; result: string }>).value.result);
            disabledReason = (reasonResult as string) || null;
          } catch { /* use default */ }
        }

        return {
          mintEnabled,
          claimEnabled,
          activePaymentToken,
          sponsoredMintEnabled,
          disabledReason,
          lastFetched: Date.now(),
          isLoaded: true,
        };
      } catch (error) {
        console.error('[AdminConfig] Decode failed:', error);
        return FAIL_CLOSED_ADMIN_CONFIG;
      }
    }, pendingAdminConfigRef, FAIL_CLOSED_ADMIN_CONFIG);
  }, [safeRpcCall]);

  // ============ FETCH ANTI-BOT CONFIG ============
  const fetchAntiBotConfig = useCallback(async (walletAddress: string): Promise<AntiBotConfig | null> => {
    try {
      const [cooldownData, lastMintData, countData, maxData] = await Promise.all([
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintCooldown', args: [] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'lastMintTime', args: [walletAddress as `0x${string}`] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'walletMintCount', args: [walletAddress as `0x${string}`] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'maxMintsPerWallet', args: [] }) }, 'latest']),
      ]);

      const cooldown = decodeUint256Result(cooldownData, 'mintCooldown');
      const lastMintTime = decodeUint256Result(lastMintData, 'lastMintTime');
      const mintCount = decodeUint256Result(countData, 'walletMintCount');
      const maxMints = decodeUint256Result(maxData, 'maxMintsPerWallet');

      const now = BigInt(Math.floor(Date.now() / 1000));
      const cooldownEnd = lastMintTime + cooldown;
      const cooldownRemaining = cooldownEnd > now ? cooldownEnd - now : 0n;
      const canMintNow = now >= cooldownEnd && (maxMints === 0n || mintCount < maxMints);

      return { cooldown, lastMintTime, mintCount, maxMints, canMintNow, cooldownRemaining };
    } catch (error) {
      console.error('[AntiBot] Failed to fetch config:', error);
      return null;
    }
  }, [decodeUint256Result]);

  // ============ NETWORK VERIFICATION ============
  const verifyBaseNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false;
    if (isNetworkSwitchingRef.current) return false;
    
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      currentChainRef.current = chainId;
      
      if (chainId.toLowerCase() !== BASE_CHAIN_ID) {
        isNetworkSwitchingRef.current = true;
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID }],
          });
          currentChainRef.current = BASE_CHAIN_ID;
          return true;
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: BASE_CHAIN_ID,
                  chainName: 'Base',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org'],
                }],
              });
              currentChainRef.current = BASE_CHAIN_ID;
              return true;
            } catch { return false; }
          }
          return false;
        } finally {
          isNetworkSwitchingRef.current = false;
        }
      }
      return true;
    } catch { return false; }
  }, []);

  // ============ PRE-MINT ENFORCEMENT ============
  const enforceMintAllowed = useCallback(async (
    walletAddress: string,
    requiredToken: PaymentToken
  ): Promise<{ allowed: boolean; error: string | null; config: AdminConfig }> => {
    if (isNetworkSwitchingRef.current) {
      return { allowed: false, error: 'Network switch in progress', config: FAIL_CLOSED_ADMIN_CONFIG };
    }

    // Issue #3: Always fetch fresh admin config - never rely on cached token
    const config = await fetchAdminConfig(true);
    setMintState(prev => ({ ...prev, adminConfig: config, isLoadingConfig: false }));

    if (!config.isLoaded) {
      return { allowed: false, error: 'Admin configuration unavailable', config };
    }

    if (!config.mintEnabled) {
      return { allowed: false, error: config.disabledReason || 'Minting is currently disabled', config };
    }

    if (config.activePaymentToken !== requiredToken) {
      return { allowed: false, error: `Only ${config.activePaymentToken} payments are currently accepted`, config };
    }

    const antiBot = await fetchAntiBotConfig(walletAddress);
    if (antiBot) {
      setMintState(prev => ({ ...prev, antiBotConfig: antiBot }));
      if (!antiBot.canMintNow) {
        if (antiBot.cooldownRemaining > 0n) {
          return { allowed: false, error: `Please wait ${antiBot.cooldownRemaining} seconds before minting again`, config };
        }
        if (antiBot.maxMints > 0n && antiBot.mintCount >= antiBot.maxMints) {
          return { allowed: false, error: 'Wallet mint limit reached', config };
        }
      }
    }

    return { allowed: true, error: null, config };
  }, [fetchAdminConfig, fetchAntiBotConfig]);

  // ============ PRE-CLAIM ENFORCEMENT ============
  const enforceClaimAllowed = useCallback(async (): Promise<{ allowed: boolean; error: string | null; config: AdminConfig }> => {
    if (isNetworkSwitchingRef.current) {
      return { allowed: false, error: 'Network switch in progress', config: FAIL_CLOSED_ADMIN_CONFIG };
    }

    const config = await fetchAdminConfig(true);
    setMintState(prev => ({ ...prev, adminConfig: config, isLoadingConfig: false }));

    if (!config.isLoaded) {
      return { allowed: false, error: 'Admin configuration unavailable', config };
    }

    if (!config.claimEnabled) {
      return { allowed: false, error: config.disabledReason || 'Claiming is currently disabled', config };
    }

    return { allowed: true, error: null, config };
  }, [fetchAdminConfig]);

  // ============ CHECK USDC ALLOWANCE ============
  const checkUSDCAllowance = useCallback(async (walletAddress: string): Promise<bigint> => {
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletAddress as `0x${string}`, NFT_CONTRACT_ADDRESS as `0x${string}`],
      });

      const result = await rpcCall('eth_call', [{ to: USDC_ADDRESS, data }, 'latest']);

      if (!result || result === '0x') return 0n;
      
      const decoded = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'allowance',
        data: result as `0x${string}`,
      });
      return decoded as bigint;
    } catch (error) {
      console.error('[USDC] Failed to check allowance:', error);
      return 0n;
    }
  }, []);

  // ============ APPROVE USDC ============
  // Issue #7: Require Base network verification before approval
  // Issue #4: Use MaxUint256 for approval to avoid price-change failures
  const approveUSDC = useCallback(async (
    walletAddress: string,
    _amount: bigint // Ignored - we use MaxUint256
  ): Promise<{ success: boolean; error: string | null }> => {
    // Issue #7: Verify network before approval
    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      return { success: false, error: 'Please switch to Base network before approving USDC' };
    }

    try {
      // Issue #4: Approve MaxUint256 for stable approvals
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [NFT_CONTRACT_ADDRESS as `0x${string}`, maxUint256],
      });

      const ethereum = window.ethereum as any;
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: USDC_ADDRESS, data }],
      }) as string;

      let receipt: any = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          receipt = await ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
          if (receipt) break;
        } catch { /* continue */ }
      }

      if (!receipt || receipt.status !== '0x1') {
        return { success: false, error: 'USDC approval failed' };
      }

      return { success: true, error: null };
    } catch (error: any) {
      if (error?.code === 4001) {
        return { success: false, error: 'Approval rejected by user' };
      }
      return { success: false, error: 'USDC approval failed' };
    }
  }, [verifyBaseNetwork]);

  // ============ GET MINT PRICE ETH ============
  // Issue #1: Use dedicated ETH price lock
  const getMintPriceETH = useCallback(async (): Promise<bigint> => {
    return safeRpcCall(async () => {
      const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'getMintPriceETH', args: [] });
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      return decodeUint256Result(result, 'getMintPriceETH');
    }, pendingEthPriceRef);
  }, [safeRpcCall, decodeUint256Result]);

  const getBatchMintPriceETH = useCallback(async (quantity: number): Promise<bigint> => {
    return safeRpcCall(async () => {
      const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'getBatchMintPriceETH', args: [BigInt(quantity)] });
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      return decodeUint256Result(result, 'getBatchMintPriceETH');
    }, pendingEthPriceRef);
  }, [safeRpcCall, decodeUint256Result]);

  // ============ GET MINT PRICE USDC ============
  // Issue #1: Use dedicated USDC price lock
  const getMintPriceUSDC = useCallback(async (): Promise<bigint> => {
    return safeRpcCall(async () => {
      const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintPriceUSDC', args: [] });
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      return decodeUint256Result(result, 'mintPriceUSDC');
    }, pendingUsdcPriceRef);
  }, [safeRpcCall, decodeUint256Result]);

  const getBatchMintPriceUSDC = useCallback(async (quantity: number): Promise<bigint> => {
    return safeRpcCall(async () => {
      const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'getBatchMintPriceUSDC', args: [BigInt(quantity)] });
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      return decodeUint256Result(result, 'getBatchMintPriceUSDC');
    }, pendingUsdcPriceRef);
  }, [safeRpcCall, decodeUint256Result]);

  // ============ WAIT FOR RECEIPT ============
  const waitForReceipt = useCallback(async (
    txHash: string,
    expectedRecipient: string
  ): Promise<{ success: boolean; tokenIds: string[] }> => {
    let receipt: any = null;
    
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        receipt = await window.ethereum!.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
        if (receipt) break;
      } catch { /* continue */ }
    }

    if (!receipt) throw new Error('Transaction is still pending');
    if (receipt.status !== '0x1') throw new Error('Transaction failed on-chain');

    const logs = (receipt.logs as Array<{ address: string; topics: string[]; data: string }>) || [];
    const tokenIds: string[] = [];
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    for (const log of logs) {
      if (log.address?.toLowerCase() !== NFT_CONTRACT_ADDRESS.toLowerCase()) continue;
      
      try {
        const decoded = decodeEventLog({
          abi: [ERC721_TRANSFER_EVENT],
          data: log.data as `0x${string}`,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        }) as { eventName: string; args: { from: string; to: string; tokenId: bigint } };
        
        if (
          decoded.eventName === 'Transfer' &&
          decoded.args.from.toLowerCase() === zeroAddress.toLowerCase() &&
          decoded.args.to.toLowerCase() === expectedRecipient.toLowerCase() &&
          decoded.args.tokenId !== undefined
        ) {
          tokenIds.push(decoded.args.tokenId.toString());
        }
      } catch { continue; }
    }

    return { success: true, tokenIds };
  }, []);

  // ============ NOTIFY MINTED ============
  const notifyMinted = useCallback((walletAddress: string, tokenIds: string[], txHash: string) => {
    window.dispatchEvent(
      new CustomEvent('memorymint:nft-minted', {
        detail: { address: walletAddress, tokenIds, txHash },
      })
    );
  }, []);

  // ============ INTERNAL MINT EXECUTOR ============
  // Issue #3: executeMint fetches fresh config and determines token internally
  const executeMint = useCallback(async (
    walletAddress: string,
    tokenURI: string | null,
    quantity: number
  ): Promise<boolean> => {
    if (!window.ethereum || !walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    // Issue #8: Simple boolean lock
    if (pendingMintRef.current) {
      return false;
    }
    pendingMintRef.current = true;

    try {
      // Issue #3: Fetch fresh config - token is determined here, not by caller
      const freshConfig = await fetchAdminConfig(true);
      const paymentToken = freshConfig.activePaymentToken;
      
      const { allowed, error, config } = await enforceMintAllowed(walletAddress, paymentToken);
      if (!allowed) {
        setMintState(prev => ({ ...prev, error }));
        return false;
      }

      const isBase = await verifyBaseNetwork();
      if (!isBase) {
        setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
        return false;
      }

      setMintState(prev => ({
        ...prev,
        isMinting: true,
        error: null,
        success: false,
        selectedPaymentToken: paymentToken,
      }));

      let txHash: string;
      let isSponsored = false;

      if (paymentToken === 'USDC') {
        const priceUSDC = quantity === 1 ? await getMintPriceUSDC() : await getBatchMintPriceUSDC(quantity);
        setMintState(prev => ({ ...prev, mintPriceUSDC: formatUSDCAmount(priceUSDC) }));

        if (priceUSDC > 0n) {
          const allowance = await checkUSDCAllowance(walletAddress);
          if (allowance < priceUSDC) {
            const { success: approved, error: approvalError } = await approveUSDC(walletAddress, priceUSDC);
            if (!approved) {
              setMintState(prev => ({ ...prev, isMinting: false, error: approvalError }));
              return false;
            }
          }
        }

        const data = quantity === 1
          ? encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintWithUSDC', args: [tokenURI || ''] })
          : encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'batchMintWithUSDC', args: [BigInt(quantity)] });

        txHash = await (window.ethereum as any).request({
          method: 'eth_sendTransaction',
          params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
        });
      } else {
        const priceWei = quantity === 1 ? await getMintPriceETH() : await getBatchMintPriceETH(quantity);
        setMintState(prev => ({ ...prev, mintPriceEth: formatWeiToEth(priceWei) }));

        const data = quantity === 1
          ? encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintNFT', args: [tokenURI || ''] })
          : encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'batchMint', args: [BigInt(quantity)] });

        const canSponsor = 
          priceWei === 0n && 
          config.sponsoredMintEnabled && 
          config.isLoaded &&
          paymentToken === 'ETH' &&
          supportsWalletSendCalls();

        if (canSponsor) {
          // Issue #2 & #5: Sponsored mint is all-or-nothing - no fallback
          try {
            const callId = await (window.ethereum as any).request({
              method: 'wallet_sendCalls',
              params: [{
                version: '1.0',
                chainId: BASE_CHAIN_ID,
                from: walletAddress,
                calls: [{ to: NFT_CONTRACT_ADDRESS, data, value: '0x0' }],
                capabilities: {
                  [BASE_CHAIN_ID]: {
                    paymasterService: { url: COINBASE_PAYMASTER_URL },
                  },
                },
              }],
            });

            // Issue #5: Poll for confirmation - do not continue without confirmed tx
            let confirmed = false;
            for (let i = 0; i < 60; i++) {
              try {
                const status = await (window.ethereum as any).request({
                  method: 'wallet_getCallsStatus',
                  params: [callId],
                });
                if (status?.status === 'CONFIRMED' && status?.receipts?.[0]?.transactionHash) {
                  txHash = status.receipts[0].transactionHash;
                  isSponsored = true;
                  confirmed = true;
                  break;
                }
                if (status?.status === 'FAILED') {
                  throw new Error('Sponsored transaction failed');
                }
              } catch (statusErr: any) {
                if (statusErr?.message?.includes('Sponsored transaction failed')) {
                  throw statusErr;
                }
              }
              await new Promise(r => setTimeout(r, 2000));
            }
            
            // Issue #5: If not confirmed, throw error - do NOT fabricate txHash
            if (!confirmed) {
              throw new Error('Sponsored transaction was not confirmed. Please try again.');
            }
          } catch (sponsorErr: any) {
            // Issue #2: Do NOT fallback to paid transaction - abort entirely
            console.error('[Mint] Sponsored transaction failed:', sponsorErr);
            throw new Error(sponsorErr?.message || 'Sponsored mint failed. Please try again.');
          }
        } else {
          txHash = await (window.ethereum as any).request({
            method: 'eth_sendTransaction',
            params: [{
              from: walletAddress,
              to: NFT_CONTRACT_ADDRESS,
              data,
              value: priceWei > 0n ? `0x${priceWei.toString(16)}` : '0x0',
            }],
          });
        }
      }

      setMintState(prev => ({ ...prev, txHash, isSponsored }));

      const { success, tokenIds } = await waitForReceipt(txHash!, walletAddress);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        success,
        isSponsored,
      }));

      if (success) notifyMinted(walletAddress, tokenIds, txHash!);
      return success;
    } catch (error: unknown) {
      console.error('[Mint] Error:', error);
      setMintState(prev => ({ ...prev, isMinting: false, error: decodeMintError(error) }));
      return false;
    } finally {
      // Issue #8: Always release lock
      pendingMintRef.current = false;
    }
  }, [fetchAdminConfig, enforceMintAllowed, verifyBaseNetwork, getMintPriceETH, getBatchMintPriceETH, getMintPriceUSDC, getBatchMintPriceUSDC, checkUSDCAllowance, approveUSDC, waitForReceipt, notifyMinted]);

  // ============ PUBLIC MINT FUNCTIONS ============
  // Issue #3: Do not pass token - executeMint determines it from fresh config
  const mintNFT = useCallback(async (tokenURI: string, walletAddress: string): Promise<boolean> => {
    return executeMint(walletAddress, tokenURI, 1);
  }, [executeMint]);

  const batchMintNFT = useCallback(async (walletAddress: string, quantity: number): Promise<boolean> => {
    if (quantity < 1 || quantity > 10) {
      setMintState(prev => ({ ...prev, error: 'Batch size must be 1-10' }));
      return false;
    }
    return executeMint(walletAddress, null, quantity);
  }, [executeMint]);

  const quickMint = useCallback(async (walletAddress: string): Promise<boolean> => {
    return executeMint(walletAddress, '', 1);
  }, [executeMint]);

  const mintWithSignature = useCallback(async (
    tokenURI: string,
    walletAddress: string,
    expiration: bigint,
    signature: `0x${string}`
  ): Promise<boolean> => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (expiration <= now) {
      setMintState(prev => ({ ...prev, error: 'Signature has expired' }));
      return false;
    }

    // Issue #3: Fetch fresh config
    const freshConfig = await fetchAdminConfig(true);
    const { allowed, error } = await enforceMintAllowed(walletAddress, 'ETH');
    if (!allowed) {
      setMintState(prev => ({ ...prev, error }));
      return false;
    }

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
      return false;
    }

    setMintState(prev => ({ ...prev, isMinting: true, error: null }));

    try {
      const priceWei = await getMintPriceETH();
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'mintWithSignature',
        args: [tokenURI, expiration, signature],
      });

      const txHash = await (window.ethereum as any).request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: NFT_CONTRACT_ADDRESS,
          data,
          value: priceWei > 0n ? `0x${priceWei.toString(16)}` : '0x0',
        }],
      });

      const { success, tokenIds } = await waitForReceipt(txHash, walletAddress);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds,
        success,
      }));

      if (success) notifyMinted(walletAddress, tokenIds, txHash);
      return success;
    } catch (error: unknown) {
      setMintState(prev => ({ ...prev, isMinting: false, error: decodeMintError(error) }));
      return false;
    }
  }, [fetchAdminConfig, enforceMintAllowed, verifyBaseNetwork, getMintPriceETH, waitForReceipt, notifyMinted]);

  // ============ BONUS CLAIM PRE-ELIGIBILITY CHECK ============
  // Issue #6: Check eligibility before wallet prompt
  const checkBonusEligibility = useCallback(async (
    walletAddress: string,
    levelId: bigint
  ): Promise<{ eligible: boolean; reason: string }> => {
    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'canClaimBonus',
        args: [walletAddress as `0x${string}`, levelId],
      });

      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);

      if (!result || result === '0x') {
        return { eligible: false, reason: 'Unable to check eligibility' };
      }

      const decoded = decodeFunctionResult({
        abi: CONTRACT_ABI,
        functionName: 'canClaimBonus',
        data: result as `0x${string}`,
      }) as [boolean, string];

      return { eligible: decoded[0], reason: decoded[1] || (decoded[0] ? 'Eligible' : 'Not eligible') };
    } catch (error) {
      console.error('[ClaimBonus] Eligibility check failed:', error);
      return { eligible: false, reason: 'Error checking eligibility' };
    }
  }, []);

  // ============ BONUS CLAIM ============
  const claimBonus = useCallback(async (
    walletAddress: string,
    levelId: bigint,
    gameLevel: bigint,
    levelProof: `0x${string}`
  ): Promise<{ success: boolean; txHash: string | null; error: string | null }> => {
    if (!window.ethereum || !walletAddress) {
      return { success: false, txHash: null, error: 'Wallet not connected' };
    }

    // Issue #6: Check eligibility BEFORE wallet prompt
    const eligibility = await checkBonusEligibility(walletAddress, levelId);
    if (!eligibility.eligible) {
      return { success: false, txHash: null, error: eligibility.reason };
    }

    const { allowed, error, config } = await enforceClaimAllowed();
    if (!allowed) {
      return { success: false, txHash: null, error };
    }

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      return { success: false, txHash: null, error: 'Please switch to Base network' };
    }

    setMintState(prev => ({ ...prev, isClaiming: true, error: null }));

    try {
      const functionName = config.activePaymentToken === 'USDC' ? 'claimBonusAsUSDC' : 'claimBonus';
      
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName,
        args: [levelId, gameLevel, levelProof],
      });

      const txHash = await (window.ethereum as any).request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
      }) as string;

      let receipt: any = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          receipt = await window.ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
          if (receipt) break;
        } catch { /* continue */ }
      }

      const success = receipt?.status === '0x1';
      
      setMintState(prev => ({
        ...prev,
        isClaiming: false,
        txHash,
        success,
        error: success ? null : 'Claim failed',
      }));

      return { success, txHash, error: success ? null : 'Claim failed' };
    } catch (error: unknown) {
      const errorMessage = decodeMintError(error);
      setMintState(prev => ({ ...prev, isClaiming: false, error: errorMessage }));
      return { success: false, txHash: null, error: errorMessage };
    }
  }, [checkBonusEligibility, enforceClaimAllowed, verifyBaseNetwork]);

  // ============ RESET STATE ============
  const resetMintState = useCallback(() => {
    setMintState(prev => ({
      ...prev,
      isMinting: false,
      isClaiming: false,
      txHash: null,
      tokenId: null,
      tokenIds: null,
      error: null,
      success: false,
      isSponsored: false,
      mintPriceEth: null,
      mintPriceUSDC: null,
    }));
    pendingMintRef.current = false;
    pendingEthPriceRef.current = false;
    pendingUsdcPriceRef.current = false;
  }, []);

  // ============ REFRESH ADMIN CONFIG ============
  const refreshAdminConfig = useCallback(async () => {
    setMintState(prev => ({ ...prev, isLoadingConfig: true }));
    const config = await fetchAdminConfig(true);
    setMintState(prev => ({ ...prev, adminConfig: config, isLoadingConfig: false }));
    return config;
  }, [fetchAdminConfig]);

  // ============ BACKWARD COMPATIBILITY HELPERS ============
  const getMintPriceEstimate = useCallback(async (quantity = 1) => {
    const priceWei = quantity === 1 ? await getMintPriceETH() : await getBatchMintPriceETH(quantity);
    return { priceWei, priceEth: formatWeiToEth(priceWei), isFree: priceWei === 0n };
  }, [getMintPriceETH, getBatchMintPriceETH]);

  const checkBalance = useCallback(async (walletAddress: string, quantity = 1) => {
    const balanceHex = await window.ethereum?.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] }) as string;
    const balance = BigInt(balanceHex || '0');
    const required = quantity === 1 ? await getMintPriceETH() : await getBatchMintPriceETH(quantity);
    const hasEnough = balance >= required;
    const shortfall = hasEnough ? null : formatWeiToEth(required - balance);
    return { hasEnough, balance: formatWeiToEth(balance), required: formatWeiToEth(required), shortfall, token: 'ETH' as PaymentToken };
  }, [getMintPriceETH, getBatchMintPriceETH]);

  // ============ INIT ============
  useEffect(() => {
    refreshAdminConfig();
    
    const handleChainChanged = () => {
      isNetworkSwitchingRef.current = true;
      resetMintState();
      setTimeout(() => {
        isNetworkSwitchingRef.current = false;
        refreshAdminConfig();
      }, 1000);
    };

    if (window.ethereum) {
      window.ethereum.on?.('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
      }
    };
  }, [refreshAdminConfig, resetMintState]);

  return {
    ...mintState,
    mintNFT,
    batchMintNFT,
    quickMint,
    mintWithSignature,
    claimBonus,
    checkBonusEligibility,
    resetMintState,
    refreshAdminConfig,
    getMintPriceETH,
    getBatchMintPriceETH,
    getMintPriceUSDC,
    getBatchMintPriceUSDC,
    getMintPriceEstimate,
    checkBalance,
    checkUSDCAllowance,
    approveUSDC,
    fetchAntiBotConfig,
    NFT_CONTRACT_ADDRESS,
    USDC_ADDRESS,
    BASE_CHAIN_ID,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
