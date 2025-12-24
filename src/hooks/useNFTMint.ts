import { useState, useCallback, useRef, useEffect } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult, decodeFunctionResult, decodeEventLog, formatEther, formatUnits } from 'viem';

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

// Coinbase Paymaster URL for Base Mainnet (sponsored transactions)
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

// Custom errors for precise UX messaging
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
  isLoaded: boolean; // Issue #1: Track if config was successfully loaded
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
// Issue #1: All admin controls default to DISABLED
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

// Issue #9: Safe ETH formatting using formatEther
function formatWeiToEth(wei: bigint): string {
  return formatEther(wei);
}

// Issue #9: Safe USDC formatting using formatUnits
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
    } catch {
      // Fall through
    }
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

// RPC call helper with fallback
async function rpcCall(method: string, params: any[]): Promise<any> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });
      
      if (!response.ok) continue;
      const data = await response.json();
      if (data.error) continue;
      return data.result;
    } catch {
      continue;
    }
  }
  throw new Error('All RPC endpoints failed');
}

// ============ MAIN HOOK ============
export function useNFTMint() {
  // Issue #1: FAIL-CLOSED default state
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
  
  // Issue #7: Oracle concurrency - use refs for reliable cleanup
  const pendingOracleRef = useRef<boolean>(false);
  const pendingAdminConfigRef = useRef<boolean>(false);
  const pendingMintRef = useRef<string | null>(null);
  
  // Issue #14: Track chain to detect network switches
  const currentChainRef = useRef<string | null>(null);
  const isNetworkSwitchingRef = useRef<boolean>(false);

  // ============ SAFE RPC WRAPPER (Issue #7) ============
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
      // Issue #7: ALWAYS reset pending flag
      pendingRef.current = false;
    }
  }, []);

  // ============ ABI DECODE HELPER (Issue #8) ============
  // Issue #8: FAIL-CLOSED - no fallback to BigInt
  const decodeUint256Result = useCallback((
    result: string,
    functionName: string
  ): bigint => {
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
      // Issue #8: NO FALLBACK - fail closed
      console.error(`[Decode] Failed to decode ${functionName}:`, error);
      throw new Error(`Failed to decode ${functionName} response`);
    }
  }, []);

  // ============ FETCH ADMIN CONFIG (Issue #1, #11) ============
  const fetchAdminConfig = useCallback(async (force = false): Promise<AdminConfig> => {
    // Issue #11: Always force refresh for critical operations
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

      // Issue #1: If ANY critical call fails, return FAIL-CLOSED config
      const mintResult = results[0];
      const claimResult = results[1];
      
      if (mintResult.status === 'rejected' || claimResult.status === 'rejected') {
        console.error('[AdminConfig] Critical config call failed - using fail-closed defaults');
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

        const config: AdminConfig = {
          mintEnabled,
          claimEnabled,
          activePaymentToken,
          sponsoredMintEnabled,
          disabledReason,
          lastFetched: Date.now(),
          isLoaded: true,
        };

        console.log('[AdminConfig] Loaded:', config);
        return config;
      } catch (error) {
        console.error('[AdminConfig] Decode failed:', error);
        return FAIL_CLOSED_ADMIN_CONFIG;
      }
    }, pendingAdminConfigRef, FAIL_CLOSED_ADMIN_CONFIG);
  }, [safeRpcCall]);

  // ============ FETCH ANTI-BOT CONFIG (Issue #6) ============
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

  // ============ NETWORK VERIFICATION (Issue #14) ============
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
            } catch {
              return false;
            }
          }
          return false;
        } finally {
          isNetworkSwitchingRef.current = false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // ============ PRE-MINT ENFORCEMENT (Issue #2, #3, #4, #6) ============
  const enforceMintAllowed = useCallback(async (
    walletAddress: string,
    requiredToken: PaymentToken
  ): Promise<{ allowed: boolean; error: string | null; config: AdminConfig }> => {
    // Issue #14: Block during network switch
    if (isNetworkSwitchingRef.current) {
      return { allowed: false, error: 'Network switch in progress', config: FAIL_CLOSED_ADMIN_CONFIG };
    }

    // Issue #11: ALWAYS force refresh admin config before mint
    const config = await fetchAdminConfig(true);
    
    setMintState(prev => ({ ...prev, adminConfig: config, isLoadingConfig: false }));

    // Issue #1: Fail-closed if config not loaded
    if (!config.isLoaded) {
      return { allowed: false, error: 'Admin configuration unavailable', config };
    }

    // Issue #2: Check mint enabled
    if (!config.mintEnabled) {
      return { allowed: false, error: config.disabledReason || 'Minting is currently disabled', config };
    }

    // Issue #3: Enforce admin-defined payment token
    if (config.activePaymentToken !== requiredToken) {
      return { 
        allowed: false, 
        error: `Only ${config.activePaymentToken} payments are currently accepted`, 
        config 
      };
    }

    // Issue #6: Check anti-bot enforcement
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

  // Issue #4: Pre-claim enforcement
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

  // ============ CHECK USDC ALLOWANCE (Issue #8) ============
  const checkUSDCAllowance = useCallback(async (walletAddress: string): Promise<bigint> => {
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletAddress as `0x${string}`, NFT_CONTRACT_ADDRESS as `0x${string}`],
      });

      const result = await rpcCall('eth_call', [{ to: USDC_ADDRESS, data }, 'latest']);

      if (!result || result === '0x') return 0n;
      
      // Issue #8: Proper ABI decoding - no fallback
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
  const approveUSDC = useCallback(async (
    walletAddress: string,
    amount: bigint
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [NFT_CONTRACT_ADDRESS as `0x${string}`, amount],
      });

      const ethereum = window.ethereum as any;
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: USDC_ADDRESS, data }],
      }) as string;

      // Wait for confirmation
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
  }, []);

  // ============ GET MINT PRICE (Issue #9) ============
  const getMintPriceETH = useCallback(async (): Promise<bigint> => {
    return safeRpcCall(async () => {
      const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'getMintPriceETH', args: [] });
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      return decodeUint256Result(result, 'getMintPriceETH');
    }, pendingOracleRef);
  }, [safeRpcCall, decodeUint256Result]);

  const getBatchMintPriceETH = useCallback(async (quantity: number): Promise<bigint> => {
    return safeRpcCall(async () => {
      const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'getBatchMintPriceETH', args: [BigInt(quantity)] });
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      return decodeUint256Result(result, 'getBatchMintPriceETH');
    }, pendingOracleRef);
  }, [safeRpcCall, decodeUint256Result]);

  const getMintPriceUSDC = useCallback(async (): Promise<bigint> => {
    return safeRpcCall(async () => {
      const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintPriceUSDC', args: [] });
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      return decodeUint256Result(result, 'mintPriceUSDC');
    }, pendingOracleRef);
  }, [safeRpcCall, decodeUint256Result]);

  const getBatchMintPriceUSDC = useCallback(async (quantity: number): Promise<bigint> => {
    return safeRpcCall(async () => {
      const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'getBatchMintPriceUSDC', args: [BigInt(quantity)] });
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      return decodeUint256Result(result, 'getBatchMintPriceUSDC');
    }, pendingOracleRef);
  }, [safeRpcCall, decodeUint256Result]);

  // ============ WAIT FOR RECEIPT (Issue #10) ============
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

    // Issue #10: Robust token ID extraction using ABI decoding
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
        
        // Issue #10: Only include mints (from = 0x0) to the expected recipient
        if (
          decoded.eventName === 'Transfer' &&
          decoded.args.from.toLowerCase() === zeroAddress.toLowerCase() &&
          decoded.args.to.toLowerCase() === expectedRecipient.toLowerCase() &&
          decoded.args.tokenId !== undefined
        ) {
          tokenIds.push(decoded.args.tokenId.toString());
        }
      } catch {
        continue;
      }
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

  // ============ INTERNAL MINT EXECUTOR (Issue #12) ============
  const executeMint = useCallback(async (
    walletAddress: string,
    tokenURI: string | null,
    quantity: number,
    paymentToken: PaymentToken
  ): Promise<boolean> => {
    if (!window.ethereum || !walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    // Issue #14: Prevent double-minting
    const mintKey = `${walletAddress}-${Date.now()}`;
    if (pendingMintRef.current) {
      return false;
    }
    pendingMintRef.current = mintKey;

    try {
      // Issue #2: Unified enforcement for ALL mint paths
      const { allowed, error, config } = await enforceMintAllowed(walletAddress, paymentToken);
      if (!allowed) {
        setMintState(prev => ({ ...prev, error }));
        return false;
      }

      // Verify network
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
        // USDC mint path
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
        // ETH mint path
        const priceWei = quantity === 1 ? await getMintPriceETH() : await getBatchMintPriceETH(quantity);
        setMintState(prev => ({ ...prev, mintPriceEth: formatWeiToEth(priceWei) }));

        const data = quantity === 1
          ? encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintNFT', args: [tokenURI || ''] })
          : encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'batchMint', args: [BigInt(quantity)] });

        // Issue #5: Sponsored tx only if ALL conditions met
        const canSponsor = 
          priceWei === 0n && 
          config.sponsoredMintEnabled && 
          config.isLoaded &&
          paymentToken === 'ETH' &&
          supportsWalletSendCalls();

        if (canSponsor) {
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

            // Poll for confirmation
            for (let i = 0; i < 60; i++) {
              try {
                const status = await (window.ethereum as any).request({
                  method: 'wallet_getCallsStatus',
                  params: [callId],
                });
                if (status?.status === 'CONFIRMED' && status?.receipts?.[0]?.transactionHash) {
                  txHash = status.receipts[0].transactionHash;
                  isSponsored = true;
                  break;
                }
                if (status?.status === 'FAILED') throw new Error('Sponsored transaction failed');
              } catch { /* continue */ }
              await new Promise(r => setTimeout(r, 2000));
            }
            
            if (!txHash!) {
              txHash = callId;
              isSponsored = true;
            }
          } catch {
            // Fallback to regular tx
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
      pendingMintRef.current = null;
    }
  }, [enforceMintAllowed, verifyBaseNetwork, getMintPriceETH, getBatchMintPriceETH, getMintPriceUSDC, getBatchMintPriceUSDC, checkUSDCAllowance, approveUSDC, waitForReceipt, notifyMinted]);

  // ============ PUBLIC MINT FUNCTIONS (Issue #12: All go through executeMint) ============
  const mintNFT = useCallback(async (tokenURI: string, walletAddress: string): Promise<boolean> => {
    return executeMint(walletAddress, tokenURI, 1, mintState.adminConfig.activePaymentToken);
  }, [executeMint, mintState.adminConfig.activePaymentToken]);

  const batchMintNFT = useCallback(async (walletAddress: string, quantity: number): Promise<boolean> => {
    if (quantity < 1 || quantity > 10) {
      setMintState(prev => ({ ...prev, error: 'Batch size must be 1-10' }));
      return false;
    }
    return executeMint(walletAddress, null, quantity, mintState.adminConfig.activePaymentToken);
  }, [executeMint, mintState.adminConfig.activePaymentToken]);

  const quickMint = useCallback(async (walletAddress: string): Promise<boolean> => {
    return executeMint(walletAddress, '', 1, mintState.adminConfig.activePaymentToken);
  }, [executeMint, mintState.adminConfig.activePaymentToken]);

  // Issue #13: Signature expiry pre-check
  const mintWithSignature = useCallback(async (
    tokenURI: string,
    walletAddress: string,
    expiration: bigint,
    signature: `0x${string}`
  ): Promise<boolean> => {
    // Issue #13: Validate expiration before wallet prompt
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (expiration <= now) {
      setMintState(prev => ({ ...prev, error: 'Signature has expired' }));
      return false;
    }

    const { allowed, error, config } = await enforceMintAllowed(walletAddress, 'ETH');
    if (!allowed) {
      setMintState(prev => ({ ...prev, error }));
      return false;
    }

    // Continue with signature mint...
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
  }, [enforceMintAllowed, verifyBaseNetwork, getMintPriceETH, waitForReceipt, notifyMinted]);

  // ============ BONUS CLAIM (Issue #4) ============
  const claimBonus = useCallback(async (
    walletAddress: string,
    levelId: bigint,
    gameLevel: bigint,
    levelProof: `0x${string}`
  ): Promise<{ success: boolean; txHash: string | null; error: string | null }> => {
    if (!window.ethereum || !walletAddress) {
      return { success: false, txHash: null, error: 'Wallet not connected' };
    }

    // Issue #4: ALWAYS check claim allowed before wallet prompt
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
      // Use admin-defined payout token
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

      // Wait for confirmation
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
  }, [enforceClaimAllowed, verifyBaseNetwork]);

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
    pendingMintRef.current = null;
    pendingOracleRef.current = false;
  }, []);

  // ============ REFRESH ADMIN CONFIG ============
  const refreshAdminConfig = useCallback(async () => {
    setMintState(prev => ({ ...prev, isLoadingConfig: true }));
    const config = await fetchAdminConfig(true);
    setMintState(prev => ({ ...prev, adminConfig: config, isLoadingConfig: false }));
    return config;
  }, [fetchAdminConfig]);

  // ============ INIT ============
  useEffect(() => {
    refreshAdminConfig();
    
    // Issue #14: Listen for chain changes
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

  // Backward compatibility helpers
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

  return {
    ...mintState,
    // Mint functions
    mintNFT,
    batchMintNFT,
    quickMint,
    mintWithSignature,
    // Claim function
    claimBonus,
    // State management
    resetMintState,
    refreshAdminConfig,
    // Price getters
    getMintPriceETH,
    getBatchMintPriceETH,
    getMintPriceUSDC,
    getMintPriceEstimate,
    checkBalance,
    getBatchMintPriceUSDC,
    // Utilities
    checkUSDCAllowance,
    approveUSDC,
    fetchAntiBotConfig,
    // Constants
    NFT_CONTRACT_ADDRESS,
    USDC_ADDRESS,
    BASE_CHAIN_ID,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
