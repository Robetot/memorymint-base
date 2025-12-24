import { useState, useCallback, useRef, useEffect } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult, decodeFunctionResult } from 'viem';

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

// Rate limiting constants
const MIN_MINT_INTERVAL_MS = 3000;
const MAX_MINTS_PER_SESSION = 20;

// Payment token types
export type PaymentToken = 'ETH' | 'USDC';

// ============ CONTRACT ABI ============
// Dual payment support: ETH (default) and USDC
const CONTRACT_ABI = parseAbi([
  // ETH payment functions
  'function mintNFT(string tokenURI) payable returns (uint256)',
  'function mintWithSignature(string tokenURI, uint256 expiration, bytes signature) payable returns (uint256)',
  'function batchMint(uint256 quantity) payable returns (uint256)',
  // USDC payment functions
  'function mintWithUSDC(string tokenURI) returns (uint256)',
  'function batchMintWithUSDC(uint256 quantity) returns (uint256)',
  // Bonus claim functions (ETH or USDC payout)
  'function claimBonus(uint256 levelId, uint256 gameLevel, bytes levelProof) external',
  'function claimBonusAsUSDC(uint256 levelId, uint256 gameLevel, bytes levelProof) external',
  // Price getters - ETH (oracle-derived)
  'function mintPriceUSDC() view returns (uint256)',
  'function getMintPriceETH() view returns (uint256)',
  'function getBatchMintPriceETH(uint256 quantity) view returns (uint256)',
  // Price getters - USDC (canonical)
  'function getBatchMintPriceUSDC(uint256 quantity) view returns (uint256)',
  // Oracle
  'function getEthUsdPrice() view returns (uint256)',
  // Bonus
  'function getBonusAmountETH(uint256 levelId) view returns (uint256)',
  'function getBonusAmountUSDC(uint256 levelId) view returns (uint256)',
  'function canClaimBonus(address user, uint256 levelId) view returns (bool, string)',
  'function getBonusLevel(uint256 levelId) view returns (uint256, bool, uint256, uint256, bool)',
  'function bonusLevels(uint256 levelId) view returns (uint256, bool, uint256, uint256, bool, uint8)',
  'function owner() view returns (address)',
]);

// ERC20 ABI for USDC approval
const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

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
]);

// ============ TYPES ============
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
}

export interface BonusClaimState {
  isClaiming: boolean;
  txHash: string | null;
  error: string | null;
  success: boolean;
  amountClaimed: string | null;
  payoutToken: PaymentToken;
}

export interface PriceInfo {
  ethPrice: bigint;       // ETH/USD price (8 decimals from Chainlink)
  mintPriceUSDC: bigint;  // Mint price in USDC (6 decimals) - CANONICAL
  mintPriceETH: bigint;   // Mint price in ETH (18 decimals) - oracle-derived
  mintPriceUSDCFormatted: string;
  mintPriceETHFormatted: string;
}

export interface BalanceCheck {
  hasEnough: boolean;
  balance: string;
  required: string;
  shortfall: string | null;
  token: PaymentToken;
}

// ============ HELPER FUNCTIONS ============

function encodeMintNFTCallData(tokenURI: string): `0x${string}` {
  return encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: 'mintNFT',
    args: [tokenURI],
  });
}

function encodeMintWithUSDCCallData(tokenURI: string): `0x${string}` {
  return encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: 'mintWithUSDC',
    args: [tokenURI],
  });
}

function encodeBatchMintCallData(quantity: number): `0x${string}` {
  return encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: 'batchMint',
    args: [BigInt(quantity)],
  });
}

function encodeBatchMintWithUSDCCallData(quantity: number): `0x${string}` {
  return encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: 'batchMintWithUSDC',
    args: [BigInt(quantity)],
  });
}

function decodeMintError(error: unknown): string {
  const err: any = error;

  // User rejected
  if (err?.code === 4001) return 'Transaction rejected by user';

  // Extract revert data
  const revertData: unknown =
    err?.data?.data ??
    err?.data ??
    err?.error?.data?.data ??
    err?.error?.data;

  if (typeof revertData === 'string' && revertData.startsWith('0x')) {
    try {
      const decoded = decodeErrorResult({
        abi: CONTRACT_ERROR_ABI,
        data: revertData as `0x${string}`,
      });

      switch (decoded.errorName) {
        case 'InsufficientPayment':
          return 'Insufficient payment. Please ensure you have enough ETH.';
        case 'InvalidQuantity':
        case 'MaxBatchExceeded':
          return 'Batch size must be 1–10';
        case 'TransferToNonReceiver':
          return 'Recipient cannot receive ERC-721 tokens';
        case 'NotOwner':
          return 'Not authorized';
        // Issue #7: User-friendly oracle error messages
        case 'OracleStalePrice':
        case 'OracleInvalidPrice':
        case 'OracleNotSet':
          return 'Price feed temporarily unavailable. Please try again.';
        default:
          return `Mint failed: ${decoded.errorName}`;
      }
    } catch {
      // Fall through to generic message
    }
  }

  const rawMsg: string | undefined = err?.data?.message || err?.error?.message || err?.message;
  if (rawMsg) {
    // Issue #7: Detect oracle-related failures
    if (rawMsg.toLowerCase().includes('oracle') || rawMsg.toLowerCase().includes('price feed')) {
      return 'Price feed temporarily unavailable. Please try again.';
    }
    if (rawMsg.includes('insufficient funds')) {
      return 'Insufficient ETH balance for transaction';
    }
    if (rawMsg.includes('gas required exceeds')) {
      return 'Transaction would fail. Please check your balance.';
    }
    return rawMsg;
  }
  return 'Minting failed. Please try again.';
}

// Detect if wallet supports sponsored transactions (EIP-5792)
function supportsWalletSendCalls(): boolean {
  const ethereum = window.ethereum as any;
  if (!ethereum) return false;
  return !!(ethereum.isSmartWallet || ethereum.isPasskeyWallet || ethereum.isCoinbaseWallet);
}

// Get paymaster service URL
function getPaymasterServiceUrl(): string {
  return COINBASE_PAYMASTER_URL;
}

// Format wei to ETH string
function formatWeiToEth(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(6);
}

// RPC call helper with fallback endpoints
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
  });
  
  // Prevent double-minting on retries
  const pendingMintRef = useRef<string | null>(null);
  
  // Issue #8: Anti-bot rate limiting state
  const lastMintAttemptRef = useRef<number>(0);
  const mintCountSessionRef = useRef<number>(0);
  const pendingOracleReadRef = useRef<boolean>(false);

  // ============ NETWORK VERIFICATION ============
  const verifyBaseNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false;
    
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      if (chainId.toLowerCase() !== BASE_CHAIN_ID) {
        // Try to switch to Base
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID }],
          });
          return true;
        } catch (switchError: any) {
          // Chain not added, try to add it
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
              return true;
            } catch {
              return false;
            }
          }
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // Issue #8: Check rate limiting before mint attempts
  const checkRateLimit = useCallback((): { allowed: boolean; message?: string } => {
    const now = Date.now();
    const timeSinceLastMint = now - lastMintAttemptRef.current;
    
    if (timeSinceLastMint < MIN_MINT_INTERVAL_MS) {
      const waitTime = Math.ceil((MIN_MINT_INTERVAL_MS - timeSinceLastMint) / 1000);
      return { 
        allowed: false, 
        message: `Please wait ${waitTime} seconds before trying again.` 
      };
    }
    
    if (mintCountSessionRef.current >= MAX_MINTS_PER_SESSION) {
      return { 
        allowed: false, 
        message: 'Maximum mints per session reached. Please refresh the page.' 
      };
    }
    
    return { allowed: true };
  }, []);

  // ============ SAFE ABI DECODE HELPER ============
  // Issue #1: eth_call returns ABI-encoded data, not raw values
  // Must use decodeFunctionResult instead of BigInt(result)
  type ContractFunctionName = 'mintNFT' | 'mintWithSignature' | 'batchMint' | 'mintWithUSDC' | 'batchMintWithUSDC' |
    'claimBonus' | 'claimBonusAsUSDC' | 'mintPriceUSDC' | 'getMintPriceETH' | 'getBatchMintPriceETH' | 
    'getBatchMintPriceUSDC' | 'getEthUsdPrice' | 'getBonusAmountETH' | 'getBonusAmountUSDC' |
    'canClaimBonus' | 'getBonusLevel' | 'bonusLevels' | 'owner';
    
  const decodeUint256Result = useCallback((
    result: string,
    functionName: ContractFunctionName
  ): bigint => {
    if (!result || result === '0x') {
      return 0n;
    }
    
    try {
      const decoded = decodeFunctionResult({
        abi: CONTRACT_ABI,
        functionName,
        data: result as `0x${string}`,
      });
      
      // decodeFunctionResult returns the value directly for single return values
      return decoded as bigint;
    } catch (error) {
      console.error(`[Decode] Failed to decode ${functionName}:`, error);
      throw new Error('Failed to decode contract response');
    }
  }, []);

  // ============ READ MINT PRICE FROM CONTRACT (Issue #1: Use getMintPriceETH with proper ABI decoding) ============
  const getMintPriceETH = useCallback(async (): Promise<bigint> => {
    // Issue #8: Prevent concurrent oracle reads
    if (pendingOracleReadRef.current) {
      throw new Error('Price check in progress. Please wait.');
    }
    
    pendingOracleReadRef.current = true;
    
    try {
      // Issue #1: Use getMintPriceETH() instead of mintPrice()
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'getMintPriceETH',
        args: [],
      });

      const result = await rpcCall('eth_call', [
        { to: NFT_CONTRACT_ADDRESS, data },
        'latest',
      ]);

      // Issue #1: Properly ABI-decode the result instead of BigInt(result)
      return decodeUint256Result(result, 'getMintPriceETH');
    } catch (error) {
      console.error('[Mint] Failed to read getMintPriceETH:', error);
      // Issue #7: Don't silently fail - surface oracle errors
      throw new Error('Price feed temporarily unavailable. Please try again.');
    } finally {
      pendingOracleReadRef.current = false;
    }
  }, [decodeUint256Result]);

  // Issue #2: Get batch mint price from contract (no client-side math, proper ABI decoding)
  const getBatchMintPriceETH = useCallback(async (quantity: number): Promise<bigint> => {
    if (pendingOracleReadRef.current) {
      throw new Error('Price check in progress. Please wait.');
    }
    
    pendingOracleReadRef.current = true;
    
    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'getBatchMintPriceETH',
        args: [BigInt(quantity)],
      });

      const result = await rpcCall('eth_call', [
        { to: NFT_CONTRACT_ADDRESS, data },
        'latest',
      ]);

      // Issue #1: Properly ABI-decode the result instead of BigInt(result)
      return decodeUint256Result(result, 'getBatchMintPriceETH');
    } catch (error) {
      console.error('[Mint] Failed to read getBatchMintPriceETH:', error);
      throw new Error('Price feed temporarily unavailable. Please try again.');
    } finally {
      pendingOracleReadRef.current = false;
    }
  }, [decodeUint256Result]);

  // Legacy alias for backward compatibility
  const getMintPrice = getMintPriceETH;

  // ============ USDC PRICE GETTERS ============
  const getMintPriceUSDC = useCallback(async (): Promise<bigint> => {
    if (pendingOracleReadRef.current) {
      throw new Error('Price check in progress. Please wait.');
    }
    
    pendingOracleReadRef.current = true;
    
    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'mintPriceUSDC',
        args: [],
      });

      const result = await rpcCall('eth_call', [
        { to: NFT_CONTRACT_ADDRESS, data },
        'latest',
      ]);

      return decodeUint256Result(result, 'mintPriceUSDC');
    } catch (error) {
      console.error('[Mint] Failed to read mintPriceUSDC:', error);
      throw new Error('Price feed temporarily unavailable. Please try again.');
    } finally {
      pendingOracleReadRef.current = false;
    }
  }, [decodeUint256Result]);

  const getBatchMintPriceUSDC = useCallback(async (quantity: number): Promise<bigint> => {
    if (pendingOracleReadRef.current) {
      throw new Error('Price check in progress. Please wait.');
    }
    
    pendingOracleReadRef.current = true;
    
    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'getBatchMintPriceUSDC',
        args: [BigInt(quantity)],
      });

      const result = await rpcCall('eth_call', [
        { to: NFT_CONTRACT_ADDRESS, data },
        'latest',
      ]);

      return decodeUint256Result(result, 'getBatchMintPriceUSDC');
    } catch (error) {
      console.error('[Mint] Failed to read getBatchMintPriceUSDC:', error);
      throw new Error('Price feed temporarily unavailable. Please try again.');
    } finally {
      pendingOracleReadRef.current = false;
    }
  }, [decodeUint256Result]);

  // ============ USDC ALLOWANCE & APPROVAL ============
  const checkUSDCAllowance = useCallback(async (walletAddress: string): Promise<bigint> => {
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletAddress as `0x${string}`, NFT_CONTRACT_ADDRESS as `0x${string}`],
      });

      const result = await rpcCall('eth_call', [
        { to: USDC_ADDRESS, data },
        'latest',
      ]);

      if (!result || result === '0x') return 0n;
      return BigInt(result);
    } catch (error) {
      console.error('[USDC] Failed to check allowance:', error);
      return 0n;
    }
  }, []);

  const approveUSDC = useCallback(async (
    walletAddress: string,
    amount: bigint
  ): Promise<{ success: boolean; txHash: string | null; error: string | null }> => {
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [NFT_CONTRACT_ADDRESS as `0x${string}`, amount],
      });

      const ethereum = window.ethereum as any;
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: USDC_ADDRESS,
          data,
        }],
      }) as string;

      console.log('[USDC] Approval tx submitted:', txHash);

      // Wait for confirmation
      let receipt: any = null;
      let attempts = 0;
      while (!receipt && attempts < 60) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          receipt = await ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
        } catch { /* continue */ }
        attempts++;
      }

      if (!receipt || receipt.status !== '0x1') {
        return { success: false, txHash, error: 'USDC approval failed' };
      }

      return { success: true, txHash, error: null };
    } catch (error: any) {
      console.error('[USDC] Approval error:', error);
      if (error?.code === 4001) {
        return { success: false, txHash: null, error: 'Approval rejected by user' };
      }
      return { success: false, txHash: null, error: 'USDC approval failed' };
    }
  }, []);

  // ============ SET PAYMENT TOKEN ============
  const setSelectedPaymentToken = useCallback((token: PaymentToken) => {
    setMintState(prev => ({ ...prev, selectedPaymentToken: token }));
  }, []);

  // ============ WAIT FOR RECEIPT ============
  const waitForReceipt = useCallback(
    async (txHash: string): Promise<{ success: boolean; tokenIds: string[]; blockNumber?: string }> => {
      let receipt: any = null;
      let attempts = 0;
      const maxAttempts = 120;

      while (!receipt && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          receipt = await window.ethereum!.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
        } catch {
          // Continue polling
        }
        attempts++;
      }

      if (!receipt) {
        throw new Error('Transaction is still pending. Please wait for confirmation.');
      }

      const status = receipt.status as string;
      if (status !== '0x1') {
        throw new Error('Transaction failed on-chain');
      }

      // Extract token IDs from Transfer events
      const logs = (receipt.logs as Array<{ topics: string[] }>) || [];
      const tokenIds: string[] = [];
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

      for (const log of logs) {
        if (log.topics.length >= 4 && log.topics[0] === transferTopic) {
          const tokenId = parseInt(log.topics[3], 16).toString();
          tokenIds.push(tokenId);
        }
      }

      return { success: true, tokenIds, blockNumber: receipt.blockNumber as string | undefined };
    },
    []
  );

  // Wait for one block confirmation
  const waitForOneConfirmation = useCallback(async (minedBlockHex?: string) => {
    if (!window.ethereum || !minedBlockHex) return;

    const mined = parseInt(minedBlockHex, 16);
    const target = mined + 1;

    for (let i = 0; i < 30; i++) {
      try {
        const currentHex = (await window.ethereum.request({ method: 'eth_blockNumber' })) as string;
        const current = parseInt(currentHex, 16);
        if (current >= target) return;
      } catch {
        // Ignore
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, []);

  // Notify other components of successful mint
  const notifyMinted = useCallback((walletAddress: string, tokenIds: string[], txHash: string) => {
    window.dispatchEvent(
      new CustomEvent('memorymint:nft-minted', {
        detail: { address: walletAddress, tokenIds, txHash },
      })
    );
  }, []);

  // Issue #3: Check if sponsorship should be used (only for free mints)
  const shouldUseSponsoredTx = useCallback((ethPriceWei: bigint): boolean => {
    // Only sponsor if mint is completely free (price = 0)
    return ethPriceWei === 0n;
  }, []);

  // ============ SEND TRANSACTION ============
  const sendMintTransaction = useCallback(async (
    walletAddress: string,
    data: `0x${string}`,
    valueWei: bigint
  ): Promise<{ txHash: string; isSponsored: boolean }> => {
    const ethereum = window.ethereum as any;
    const valueHex = valueWei > 0n ? '0x' + valueWei.toString(16) : '0x0';
    
    // Issue #3: Only try sponsored transaction for FREE mints
    if (supportsWalletSendCalls() && shouldUseSponsoredTx(valueWei)) {
      try {
        console.log('[Mint] Attempting sponsored transaction via wallet_sendCalls (FREE mint)...');
        
        const calls = [{
          to: NFT_CONTRACT_ADDRESS,
          data,
          value: '0x0', // Sponsored = always free
        }];

        const capabilities: Record<string, any> = {
          [BASE_CHAIN_ID]: {
            paymasterService: {
              url: getPaymasterServiceUrl(),
            },
          },
        };

        try {
          const callId = await ethereum.request({
            method: 'wallet_sendCalls',
            params: [{
              version: '1.0',
              chainId: BASE_CHAIN_ID,
              from: walletAddress,
              calls,
              capabilities,
            }],
          });

          console.log('[Mint] wallet_sendCalls submitted:', callId);

          // Poll for confirmation
          let status: any;
          let attempts = 0;
          const maxAttempts = 60;

          while (attempts < maxAttempts) {
            try {
              status = await ethereum.request({
                method: 'wallet_getCallsStatus',
                params: [callId],
              });

              if (status?.status === 'CONFIRMED' && status?.receipts?.[0]?.transactionHash) {
                console.log('[Mint] Sponsored transaction confirmed!');
                return { txHash: status.receipts[0].transactionHash, isSponsored: true };
              }

              if (status?.status === 'FAILED') {
                throw new Error(status?.reason || 'Sponsored transaction failed');
              }
            } catch (statusErr) {
              // wallet_getCallsStatus not available
            }

            await new Promise(r => setTimeout(r, 2000));
            attempts++;
          }

          // Use callId as txHash if it looks like one
          if (callId && typeof callId === 'string' && callId.startsWith('0x')) {
            return { txHash: callId, isSponsored: true };
          }
        } catch (sponsorErr: any) {
          console.log('[Mint] Sponsored tx failed, falling back:', sponsorErr?.message);
        }
      } catch (err) {
        console.log('[Mint] wallet_sendCalls not supported');
      }
    } else if (valueWei > 0n) {
      // Issue #3: Log that we're skipping sponsorship for paid mints
      console.log('[Mint] Skipping sponsorship - ETH payment required:', formatWeiToEth(valueWei), 'ETH');
    }

    // Regular eth_sendTransaction (required for paid mints)
    console.log('[Mint] Sending regular transaction via eth_sendTransaction...');
    console.log('[Mint] Value:', valueHex, '=', formatWeiToEth(valueWei), 'ETH');
    
    const txHash = await ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
        value: valueHex,
      }],
    }) as string;

    return { txHash, isSponsored: false };
  }, [shouldUseSponsoredTx]);

  // ============ MINT NFT ============
  const mintNFT = useCallback(async (
    tokenURI: string,
    walletAddress: string
  ): Promise<boolean> => {
    if (!window.ethereum) {
      setMintState(prev => ({ ...prev, error: 'No wallet detected' }));
      return false;
    }

    if (!walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    // Issue #8: Rate limit check
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      setMintState(prev => ({ ...prev, error: rateCheck.message || 'Please wait before trying again' }));
      return false;
    }

    // Issue #8: Prevent double-click while pending
    if (mintState.isMinting || pendingOracleReadRef.current) {
      return false;
    }

    // Prevent double-minting
    const mintKey = `${walletAddress}-${Date.now()}`;
    if (pendingMintRef.current === mintKey) {
      return false;
    }
    pendingMintRef.current = mintKey;
    lastMintAttemptRef.current = Date.now();

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
      pendingMintRef.current = null;
      return false;
    }

    setMintState(prev => ({
      ...prev,
      isMinting: true,
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

    try {
      // Issue #1: Read price using getMintPriceETH (oracle-based)
      console.log('[Mint] Reading getMintPriceETH from contract (oracle)...');
      const mintPriceWei = await getMintPriceETH();
      const mintPriceEth = formatWeiToEth(mintPriceWei);
      
      console.log(`[Mint] Mint price: ${mintPriceEth} ETH (${mintPriceWei === 0n ? 'FREE' : 'paid'})`);
      setMintState(prev => ({ ...prev, mintPriceEth }));

      // Encode mint call
      const data = encodeMintNFTCallData(tokenURI);

      // Send transaction with value = oracle-derived ETH price
      const { txHash, isSponsored } = await sendMintTransaction(walletAddress, data, mintPriceWei);

      console.log('[Mint] Transaction submitted:', txHash, isSponsored ? '(SPONSORED)' : '');
      setMintState(prev => ({ ...prev, txHash, isSponsored }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      // Issue #8: Track successful mints
      if (success) {
        mintCountSessionRef.current++;
      }

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        isClaiming: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
        isSponsored,
        mintPriceEth,
      }));

      if (success) {
        notifyMinted(walletAddress, tokenIds, txHash);
      }

      pendingMintRef.current = null;
      return success;
    } catch (error: unknown) {
      console.error('[Mint] Minting error:', error);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: decodeMintError(error),
      }));
      pendingMintRef.current = null;
      return false;
    }
  }, [checkRateLimit, getMintPriceETH, mintState.isMinting, notifyMinted, sendMintTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  // ============ BATCH MINT ============
  const batchMintNFT = useCallback(async (
    walletAddress: string,
    quantity: number
  ): Promise<boolean> => {
    if (!window.ethereum) {
      setMintState(prev => ({ ...prev, error: 'No wallet detected' }));
      return false;
    }

    if (!walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    if (quantity < 1 || quantity > 10) {
      setMintState(prev => ({ ...prev, error: 'Batch size must be 1-10' }));
      return false;
    }

    // Issue #8: Rate limit check
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      setMintState(prev => ({ ...prev, error: rateCheck.message || 'Please wait before trying again' }));
      return false;
    }

    // Issue #8: Prevent double-click while pending
    if (mintState.isMinting || pendingOracleReadRef.current) {
      return false;
    }

    lastMintAttemptRef.current = Date.now();

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
      return false;
    }

    setMintState(prev => ({
      ...prev,
      isMinting: true,
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

    try {
      // Issue #2: Get batch price from contract (no client-side multiplication)
      console.log('[Mint] Reading getBatchMintPriceETH for', quantity, 'NFTs...');
      const totalPriceWei = await getBatchMintPriceETH(quantity);
      const mintPriceEth = formatWeiToEth(totalPriceWei);
      
      console.log(`[Mint] Batch mint price: ${mintPriceEth} ETH for ${quantity} NFTs (oracle-derived)`);
      setMintState(prev => ({ ...prev, mintPriceEth }));

      // Encode batch mint call
      const data = encodeBatchMintCallData(quantity);

      // Send transaction with value from contract (not client-side math)
      const { txHash, isSponsored } = await sendMintTransaction(walletAddress, data, totalPriceWei);

      console.log('[Mint] Batch transaction submitted:', txHash, isSponsored ? '(SPONSORED)' : '');
      setMintState(prev => ({ ...prev, txHash, isSponsored }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      // Issue #8: Track successful mints
      if (success) {
        mintCountSessionRef.current += quantity;
      }

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        isClaiming: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
        isSponsored,
        mintPriceEth,
      }));

      if (success) {
        notifyMinted(walletAddress, tokenIds, txHash);
      }

      return success;
    } catch (error: unknown) {
      console.error('[Mint] Batch minting error:', error);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: decodeMintError(error),
      }));
      return false;
    }
  }, [checkRateLimit, getBatchMintPriceETH, mintState.isMinting, notifyMinted, sendMintTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  // ============ MINT WITH USDC ============
  const mintWithUSDC = useCallback(async (
    tokenURI: string,
    walletAddress: string
  ): Promise<boolean> => {
    if (!window.ethereum) {
      setMintState(prev => ({ ...prev, error: 'No wallet detected' }));
      return false;
    }

    if (!walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      setMintState(prev => ({ ...prev, error: rateCheck.message || 'Please wait' }));
      return false;
    }

    if (mintState.isMinting || pendingOracleReadRef.current) {
      return false;
    }

    lastMintAttemptRef.current = Date.now();

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
      selectedPaymentToken: 'USDC',
    }));

    try {
      // Get USDC price (canonical)
      const priceUSDC = await getMintPriceUSDC();
      const formattedUSDC = (Number(priceUSDC) / 1e6).toFixed(2);
      setMintState(prev => ({ ...prev, mintPriceUSDC: `$${formattedUSDC}` }));

      // Check and request USDC approval if needed
      const currentAllowance = await checkUSDCAllowance(walletAddress);
      if (currentAllowance < priceUSDC) {
        console.log('[MintUSDC] Requesting USDC approval...');
        const { success: approved, error: approvalError } = await approveUSDC(walletAddress, priceUSDC);
        if (!approved) {
          setMintState(prev => ({ ...prev, isMinting: false, error: approvalError || 'USDC approval failed' }));
          return false;
        }
      }

      // Encode USDC mint call
      const data = encodeMintWithUSDCCallData(tokenURI);

      const ethereum = window.ethereum as any;
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: NFT_CONTRACT_ADDRESS,
          data,
        }],
      }) as string;

      console.log('[MintUSDC] Transaction submitted:', txHash);
      setMintState(prev => ({ ...prev, txHash }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      if (success) {
        mintCountSessionRef.current++;
      }

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
      }));

      if (success) {
        notifyMinted(walletAddress, tokenIds, txHash);
      }

      return success;
    } catch (error: unknown) {
      console.error('[MintUSDC] Error:', error);
      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: decodeMintError(error),
      }));
      return false;
    }
  }, [checkRateLimit, getMintPriceUSDC, checkUSDCAllowance, approveUSDC, mintState.isMinting, notifyMinted, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  // ============ BATCH MINT WITH USDC ============
  const batchMintWithUSDC = useCallback(async (
    walletAddress: string,
    quantity: number
  ): Promise<boolean> => {
    if (!window.ethereum || !walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    if (quantity < 1 || quantity > 10) {
      setMintState(prev => ({ ...prev, error: 'Batch size must be 1-10' }));
      return false;
    }

    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      setMintState(prev => ({ ...prev, error: rateCheck.message || 'Please wait' }));
      return false;
    }

    if (mintState.isMinting || pendingOracleReadRef.current) {
      return false;
    }

    lastMintAttemptRef.current = Date.now();

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
      selectedPaymentToken: 'USDC',
    }));

    try {
      const priceUSDC = await getBatchMintPriceUSDC(quantity);
      const formattedUSDC = (Number(priceUSDC) / 1e6).toFixed(2);
      setMintState(prev => ({ ...prev, mintPriceUSDC: `$${formattedUSDC}` }));

      // Check and request USDC approval
      const currentAllowance = await checkUSDCAllowance(walletAddress);
      if (currentAllowance < priceUSDC) {
        const { success: approved, error: approvalError } = await approveUSDC(walletAddress, priceUSDC);
        if (!approved) {
          setMintState(prev => ({ ...prev, isMinting: false, error: approvalError || 'USDC approval failed' }));
          return false;
        }
      }

      const data = encodeBatchMintWithUSDCCallData(quantity);

      const ethereum = window.ethereum as any;
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: NFT_CONTRACT_ADDRESS,
          data,
        }],
      }) as string;

      setMintState(prev => ({ ...prev, txHash }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      if (success) {
        mintCountSessionRef.current += quantity;
      }

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
      }));

      if (success) {
        notifyMinted(walletAddress, tokenIds, txHash);
      }

      return success;
    } catch (error: unknown) {
      console.error('[BatchMintUSDC] Error:', error);
      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: decodeMintError(error),
      }));
      return false;
    }
  }, [checkRateLimit, getBatchMintPriceUSDC, checkUSDCAllowance, approveUSDC, mintState.isMinting, notifyMinted, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  // ============ QUICK MINT (empty tokenURI) ============
  const quickMint = useCallback(async (walletAddress: string): Promise<boolean> => {
    return mintNFT('', walletAddress);
  }, [mintNFT]);

  const quickMintWithUSDC = useCallback(async (walletAddress: string): Promise<boolean> => {
    return mintWithUSDC('', walletAddress);
  }, [mintWithUSDC]);

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
  }, []);

  // ============ GET MINT PRICE ESTIMATE (Issue #2: Use contract for batch pricing) ============
  const getMintPriceEstimate = useCallback(async (quantity: number = 1): Promise<{ priceWei: bigint; priceEth: string; isFree: boolean } | null> => {
    try {
      // Issue #2: Use contract function for batch pricing, not client-side math
      const totalWei = quantity === 1 
        ? await getMintPriceETH() 
        : await getBatchMintPriceETH(quantity);
      
      return {
        priceWei: totalWei,
        priceEth: formatWeiToEth(totalWei),
        isFree: totalWei === 0n,
      };
    } catch {
      return null;
    }
  }, [getMintPriceETH, getBatchMintPriceETH]);

  // ============ CHECK BALANCE (Issue #2: Use contract for batch pricing) ============
  const checkBalance = useCallback(async (walletAddress: string, quantity: number = 1): Promise<BalanceCheck | null> => {
    if (!window.ethereum || !walletAddress) return null;

    try {
      // Get user's ETH balance
      const balanceHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [walletAddress, 'latest'],
      }) as string;
      
      const balanceWei = BigInt(balanceHex);
      const balanceEth = Number(balanceWei) / 1e18;

      // Issue #2: Get mint price from contract (use batch function for quantity > 1)
      const totalMintPriceWei = quantity === 1 
        ? await getMintPriceETH() 
        : await getBatchMintPriceETH(quantity);
      
      // Add estimated gas (0.0002 ETH conservative)
      const estimatedGasWei = BigInt(200000000000000); // 0.0002 ETH
      const requiredWei = totalMintPriceWei + estimatedGasWei;
      const requiredEth = Number(requiredWei) / 1e18;

      const hasEnough = balanceWei >= requiredWei;
      const shortfall = hasEnough ? null : (requiredEth - balanceEth).toFixed(6);

      return {
        hasEnough,
        balance: balanceEth.toFixed(6),
        required: requiredEth.toFixed(6),
        shortfall,
        token: 'ETH' as PaymentToken,
      };
    } catch (error) {
      console.error('[Balance] Check failed:', error);
      return null;
    }
  }, [getMintPriceETH, getBatchMintPriceETH]);

  // ============ FORMAT USDC (6 decimals) ============
  const formatUSDC = useCallback((amount: bigint): string => {
    const value = Number(amount) / 1e6;
    return `$${value.toFixed(2)}`;
  }, []);

  // ============ GET USDC PRICE INFO (Issue #4: USDC as primary, ETH as conversion) ============
  // Issue #3: Update mintPriceUSDC state when fetching price info
  const getPriceInfo = useCallback(async (): Promise<PriceInfo | null> => {
    try {
      // Read USDC price from contract (canonical source)
      const mintPriceUSDCData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'mintPriceUSDC',
        args: [],
      });

      // Issue #1: Use getMintPriceETH (oracle-derived)
      const getMintPriceETHData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'getMintPriceETH',
        args: [],
      });

      const getEthUsdPriceData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'getEthUsdPrice',
        args: [],
      });

      const [usdcResult, ethResult, priceResult] = await Promise.all([
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: mintPriceUSDCData }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: getMintPriceETHData }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: getEthUsdPriceData }, 'latest']),
      ]);

      // Issue #1: Properly ABI-decode all results instead of BigInt(result)
      const mintPriceUSDC = decodeUint256Result(usdcResult, 'mintPriceUSDC');
      const mintPriceETH = decodeUint256Result(ethResult, 'getMintPriceETH');
      const ethPrice = decodeUint256Result(priceResult, 'getEthUsdPrice');

      const formattedUSDC = formatUSDC(mintPriceUSDC);
      const formattedETH = formatWeiToEth(mintPriceETH);

      // Issue #3: Update mintPriceUSDC state so UI consumers receive a non-null value
      setMintState(prev => ({
        ...prev,
        mintPriceUSDC: formattedUSDC,
        mintPriceEth: formattedETH,
      }));

      // Issue #4: Return both with USDC as primary reference
      return {
        ethPrice,
        mintPriceUSDC,
        mintPriceETH,
        // Issue #4: USDC formatted as primary display
        mintPriceUSDCFormatted: formattedUSDC,
        // Issue #4: ETH shown as "estimated conversion"
        mintPriceETHFormatted: `≈ ${formattedETH} ETH`,
      };
    } catch (error) {
      console.error('[Price] Failed to get price info:', error);
      // Issue #7: Return null on oracle failure, let caller handle
      return null;
    }
  }, [formatUSDC, decodeUint256Result]);

  // ============ CHECK CAN CLAIM BONUS (Issue #5: Proper ABI decoding) ============
  const canClaimBonus = useCallback(async (
    walletAddress: string,
    levelId: bigint
  ): Promise<{ canClaim: boolean; reason: string }> => {
    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'canClaimBonus',
        args: [walletAddress as `0x${string}`, levelId],
      });

      const result = await rpcCall('eth_call', [
        { to: NFT_CONTRACT_ADDRESS, data },
        'latest',
      ]);

      if (!result || result === '0x') {
        return { canClaim: false, reason: 'Unable to check eligibility' };
      }

      // Issue #5: Properly ABI-decode (bool, string) tuple using decodeFunctionResult
      try {
        const decoded = decodeFunctionResult({
          abi: CONTRACT_ABI,
          functionName: 'canClaimBonus',
          data: result as `0x${string}`,
        });
        
        // decodeFunctionResult returns an array for multiple return values
        const [canClaim, reason] = decoded as [boolean, string];
        return { canClaim, reason: reason || (canClaim ? 'Eligible' : 'Not eligible') };
      } catch (decodeErr) {
        console.error('[ClaimBonus] ABI decode failed:', decodeErr);
        return { canClaim: false, reason: 'Failed to decode eligibility response' };
      }
    } catch (error) {
      console.error('[ClaimBonus] Check failed:', error);
      return { canClaim: false, reason: 'Error checking eligibility' };
    }
  }, []);

  // ============ CLAIM BONUS ============
  /**
   * Claim bonus for completing a game level
   * @param levelId The bonus level ID to claim
   * @param gameLevel The game level completed
   * @param levelProof Signature proving level completion (MUST include bonus level ID in signed message)
   * 
   * IMPORTANT: The levelProof must be generated by the backend with the following message:
   * keccak256(abi.encodePacked(claimer, gameLevel, bonusLevelId, contractAddress, chainId))
   * 
   * This ensures the proof cannot be reused across different bonus levels.
   */
  const claimBonus = useCallback(async (
    walletAddress: string,
    levelId: bigint,
    gameLevel: bigint,
    levelProof: `0x${string}`
  ): Promise<{ success: boolean; txHash: string | null; error: string | null }> => {
    if (!window.ethereum) {
      return { success: false, txHash: null, error: 'No wallet detected' };
    }

    if (!walletAddress) {
      return { success: false, txHash: null, error: 'Wallet not connected' };
    }

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      return { success: false, txHash: null, error: 'Please switch to Base network' };
    }

    setMintState(prev => ({ ...prev, isClaiming: true, error: null }));

    try {
      // Check eligibility first
      const { canClaim, reason } = await canClaimBonus(walletAddress, levelId);
      if (!canClaim) {
        setMintState(prev => ({ ...prev, isClaiming: false, error: reason }));
        return { success: false, txHash: null, error: reason };
      }

      // Encode claimBonus call
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'claimBonus',
        args: [levelId, gameLevel, levelProof],
      });

      const ethereum = window.ethereum as any;

      // Send transaction (no value needed for claim)
      console.log('[ClaimBonus] Sending claim transaction...');
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: NFT_CONTRACT_ADDRESS,
          data,
        }],
      }) as string;

      console.log('[ClaimBonus] Transaction submitted:', txHash);

      // Wait for confirmation
      const { success } = await waitForReceipt(txHash);

      setMintState(prev => ({
        ...prev,
        isClaiming: false,
        txHash,
        success,
        error: success ? null : 'Claim failed',
      }));

      return { success, txHash, error: success ? null : 'Claim failed' };
    } catch (error: unknown) {
      console.error('[ClaimBonus] Error:', error);
      const errorMessage = decodeMintError(error);
      setMintState(prev => ({
        ...prev,
        isClaiming: false,
        error: errorMessage,
      }));
      return { success: false, txHash: null, error: errorMessage };
    }
  }, [canClaimBonus, verifyBaseNetwork, waitForReceipt]);

  // ============ CLAIM BONUS AS USDC ============
  const claimBonusAsUSDC = useCallback(async (
    walletAddress: string,
    levelId: bigint,
    gameLevel: bigint,
    levelProof: `0x${string}`
  ): Promise<{ success: boolean; txHash: string | null; error: string | null }> => {
    if (!window.ethereum) {
      return { success: false, txHash: null, error: 'No wallet detected' };
    }

    if (!walletAddress) {
      return { success: false, txHash: null, error: 'Wallet not connected' };
    }

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      return { success: false, txHash: null, error: 'Please switch to Base network' };
    }

    setMintState(prev => ({ ...prev, isClaiming: true, error: null }));

    try {
      const { canClaim, reason } = await canClaimBonus(walletAddress, levelId);
      if (!canClaim) {
        setMintState(prev => ({ ...prev, isClaiming: false, error: reason }));
        return { success: false, txHash: null, error: reason };
      }

      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'claimBonusAsUSDC',
        args: [levelId, gameLevel, levelProof],
      });

      const ethereum = window.ethereum as any;
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: NFT_CONTRACT_ADDRESS,
          data,
        }],
      }) as string;

      console.log('[ClaimBonusUSDC] Transaction submitted:', txHash);

      const { success } = await waitForReceipt(txHash);

      setMintState(prev => ({
        ...prev,
        isClaiming: false,
        txHash,
        success,
        error: success ? null : 'Claim failed',
      }));

      return { success, txHash, error: success ? null : 'Claim failed' };
    } catch (error: unknown) {
      console.error('[ClaimBonusUSDC] Error:', error);
      const errorMessage = decodeMintError(error);
      setMintState(prev => ({
        ...prev,
        isClaiming: false,
        error: errorMessage,
      }));
      return { success: false, txHash: null, error: errorMessage };
    }
  }, [canClaimBonus, verifyBaseNetwork, waitForReceipt]);

  // ============ GET BONUS LEVEL INFO (Issue #6: USDC as canonical, ETH from oracle) ============
  // Issue #2: Remove unsafe manual hex slicing, use proper ABI decoding
  const getBonusLevel = useCallback(async (levelId: bigint): Promise<{
    amountUSDC: bigint;      // Issue #6: Canonical USDC amount
    amountETH: bigint;       // Issue #6: Oracle-derived ETH amount
    active: boolean;
    claimsRemaining: bigint;
    minScore: bigint;
    requiresNFT: boolean;
    formattedUSDC: string;   // Issue #4: Primary display
    formattedETH: string;    // Issue #4: Estimated conversion
  } | null> => {
    try {
      // Get bonus level struct
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'bonusLevels',
        args: [levelId],
      });

      // Issue #6: Also get ETH amount from oracle
      const ethAmountData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'getBonusAmountETH',
        args: [levelId],
      });

      const [result, ethResult] = await Promise.all([
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: ethAmountData }, 'latest']),
      ]);

      if (!result || result === '0x') {
        return null;
      }

      // Issue #2: Properly ABI-decode the struct using decodeFunctionResult
      // bonusLevels returns: (uint256, bool, uint256, uint256, bool)
      // Field order must match Solidity struct exactly
      try {
        const decoded = decodeFunctionResult({
          abi: CONTRACT_ABI,
          functionName: 'bonusLevels',
          data: result as `0x${string}`,
        });
        
        // Decoded tuple: [amountUSDC, active, claimsRemaining, minScore, requiresNFT]
        const [amountUSDC, active, claimsRemaining, minScore, requiresNFT] = decoded as readonly [bigint, boolean, bigint, bigint, boolean, number];
        
        // Issue #6: Get oracle-derived ETH amount with proper decoding
        const amountETH = decodeUint256Result(ethResult, 'getBonusAmountETH');

        return { 
          amountUSDC,           // Issue #6: USDC is canonical
          amountETH,            // Issue #6: ETH from oracle
          active, 
          claimsRemaining, 
          minScore, 
          requiresNFT,
          formattedUSDC: formatUSDC(amountUSDC),
          formattedETH: `≈ ${formatWeiToEth(amountETH)} ETH`,
        };
      } catch (decodeErr) {
        console.error('[BonusLevel] ABI decode failed:', decodeErr);
        return null;
      }
    } catch (error) {
      console.error('[BonusLevel] Fetch failed:', error);
      return null;
    }
  }, [formatUSDC, decodeUint256Result]);

  /**
   * Generate the message hash that the backend must sign for level proof
   * This includes the bonus level ID to prevent cross-level replay attacks
   * 
   * Message format: keccak256(abi.encodePacked(claimer, gameLevel, bonusLevelId, contractAddress, chainId))
   */
  const getLevelProofMessage = useCallback((
    claimer: string,
    gameLevel: bigint,
    bonusLevelId: bigint
  ): string => {
    // This is for reference - actual signing should happen on backend
    // The packed encoding is: address (20 bytes) + uint256 (32 bytes) + uint256 (32 bytes) + address (20 bytes) + uint256 (32 bytes)
    return `Level proof for ${claimer} at game level ${gameLevel} for bonus level ${bonusLevelId} on contract ${NFT_CONTRACT_ADDRESS} (chain 8453)`;
  }, []);

  return {
    ...mintState,
    // ETH mint functions
    mintNFT,
    batchMintNFT,
    quickMint,
    // USDC mint functions
    mintWithUSDC,
    batchMintWithUSDC,
    quickMintWithUSDC,
    // Bonus claim (ETH or USDC payout)
    claimBonus,
    claimBonusAsUSDC,
    canClaimBonus,
    getBonusLevel,
    // State management
    resetMintState,
    getMintPriceEstimate,
    getPriceInfo,
    checkBalance,
    // ETH price functions (oracle-derived)
    getMintPriceETH,
    getBatchMintPriceETH,
    getMintPrice, // Legacy alias
    // USDC price functions (canonical)
    getMintPriceUSDC,
    getBatchMintPriceUSDC,
    // USDC approval
    checkUSDCAllowance,
    approveUSDC,
    // Payment token selection
    setSelectedPaymentToken,
    // Formatting
    formatUSDC,
    getLevelProofMessage,
    // Constants
    contractAddress: NFT_CONTRACT_ADDRESS,
    usdcAddress: USDC_ADDRESS,
    usdcDecimals: USDC_DECIMALS,
    supportsSponsorship: supportsWalletSendCalls(),
    // Anti-bot helpers
    checkRateLimit,
    canMint: !mintState.isMinting && !pendingOracleReadRef.current,
    canClaim: !mintState.isClaiming,
    isOracleReading: pendingOracleReadRef.current,
  };
}
