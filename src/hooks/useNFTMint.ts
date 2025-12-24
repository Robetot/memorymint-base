import { useState, useCallback, useRef } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult, decodeAbiParameters } from 'viem';

// ============ CONFIGURATION ============
// NEW: MemoryMintFeeAware contract address on Base Mainnet
// TODO: Update this after deploying the new contract
const NFT_CONTRACT_ADDRESS = '0xBf44A549C390923fD00B17E867804355E93Bf4c0';

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

// Rate limiting constants (Issue #8: Anti-bot protection)
const MIN_MINT_INTERVAL_MS = 3000; // 3 seconds between mint attempts
const MAX_MINTS_PER_SESSION = 20;

// ============ CONTRACT ABI ============
// Minimal ABI for MemoryMintUltraSafe with USDC Oracle Pricing
const CONTRACT_ABI = parseAbi([
  'function mintNFT(string tokenURI) payable returns (uint256)',
  'function mintWithSignature(string tokenURI, uint256 expiration, bytes signature) payable returns (uint256)',
  'function batchMint(uint256 quantity) payable returns (uint256)',
  'function claimBonus(uint256 levelId, uint256 gameLevel, bytes levelProof) external',
  // Issue #1: Use getMintPriceETH as source of truth, not mintPrice
  'function mintPriceUSDC() view returns (uint256)',
  'function getMintPriceETH() view returns (uint256)',
  'function getBatchMintPriceETH(uint256 quantity) view returns (uint256)',
  'function getEthUsdPrice() view returns (uint256)',
  'function getBonusAmountETH(uint256 levelId) view returns (uint256)',
  'function canClaimBonus(address user, uint256 levelId) view returns (bool, string)',
  'function getBonusLevel(uint256 levelId) view returns (uint256, bool, uint256, uint256, bool)',
  'function bonusLevels(uint256 levelId) view returns (uint256, bool, uint256, uint256, bool)',
  'function owner() view returns (address)',
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
  'error WithdrawFailed()',
  'error ClaimNotActive()',
  'error AlreadyClaimed()',
  'error NotEligible()',
  'error InvalidLevelProof()',
  // Issue #7: Oracle-specific errors for user-friendly messaging
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
}

export interface BonusClaimState {
  isClaiming: boolean;
  txHash: string | null;
  error: string | null;
  success: boolean;
  amountClaimed: string | null;
}

export interface PriceInfo {
  ethPrice: bigint;       // ETH/USD price (8 decimals from Chainlink)
  mintPriceUSDC: bigint;  // Mint price in USDC (6 decimals)
  mintPriceETH: bigint;   // Mint price in ETH (18 decimals)
  mintPriceUSDCFormatted: string;
  mintPriceETHFormatted: string;
}

export interface BalanceCheck {
  hasEnough: boolean;
  balance: string;
  required: string;
  shortfall: string | null;
}

// ============ HELPER FUNCTIONS ============

function encodeMintNFTCallData(tokenURI: string): `0x${string}` {
  return encodeFunctionData({
    abi: CONTRACT_ABI,
    functionName: 'mintNFT',
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

  // ============ READ MINT PRICE FROM CONTRACT (Issue #1: Use getMintPriceETH) ============
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

      if (!result || result === '0x') {
        return BigInt(0); // Free mint
      }

      return BigInt(result);
    } catch (error) {
      console.error('[Mint] Failed to read getMintPriceETH:', error);
      // Issue #7: Don't silently fail - surface oracle errors
      throw new Error('Price feed temporarily unavailable. Please try again.');
    } finally {
      pendingOracleReadRef.current = false;
    }
  }, []);

  // Issue #2: Get batch mint price from contract (no client-side math)
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

      if (!result || result === '0x') {
        return BigInt(0);
      }

      return BigInt(result);
    } catch (error) {
      console.error('[Mint] Failed to read getBatchMintPriceETH:', error);
      throw new Error('Price feed temporarily unavailable. Please try again.');
    } finally {
      pendingOracleReadRef.current = false;
    }
  }, []);

  // Legacy alias for backward compatibility
  const getMintPrice = getMintPriceETH;

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

    setMintState({
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
    });

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

      setMintState({
        isMinting: false,
        isClaiming: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
        isSponsored,
        mintPriceEth,
        mintPriceUSDC: null,
      });

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

    setMintState({
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
    });

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

      setMintState({
        isMinting: false,
        isClaiming: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
        isSponsored,
        mintPriceEth,
        mintPriceUSDC: null,
      });

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

  // ============ QUICK MINT (empty tokenURI) ============
  const quickMint = useCallback(async (walletAddress: string): Promise<boolean> => {
    return mintNFT('', walletAddress);
  }, [mintNFT]);

  // ============ RESET STATE ============
  const resetMintState = useCallback(() => {
    setMintState({
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
    });
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

      const mintPriceUSDC = usdcResult ? BigInt(usdcResult) : 0n;
      const mintPriceETH = ethResult ? BigInt(ethResult) : 0n;
      const ethPrice = priceResult ? BigInt(priceResult) : 0n;

      // Issue #4: Return both with USDC as primary reference
      return {
        ethPrice,
        mintPriceUSDC,
        mintPriceETH,
        // Issue #4: USDC formatted as primary display
        mintPriceUSDCFormatted: formatUSDC(mintPriceUSDC),
        // Issue #4: ETH shown as "estimated conversion"
        mintPriceETHFormatted: `≈ ${formatWeiToEth(mintPriceETH)} ETH`,
      };
    } catch (error) {
      console.error('[Price] Failed to get price info:', error);
      // Issue #7: Return null on oracle failure, let caller handle
      return null;
    }
  }, [formatUSDC]);

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

      // Issue #5: Properly ABI-decode (bool, string) tuple instead of string checks
      try {
        const decoded = decodeAbiParameters(
          [
            { name: 'eligible', type: 'bool' },
            { name: 'reason', type: 'string' }
          ],
          result as `0x${string}`
        );
        
        const [canClaim, reason] = decoded as [boolean, string];
        return { canClaim, reason: reason || (canClaim ? 'Eligible' : 'Not eligible') };
      } catch (decodeErr) {
        // Fallback: Check first 32 bytes for boolean
        console.warn('[ClaimBonus] ABI decode fallback:', decodeErr);
        const canClaim = result.slice(0, 66).endsWith('1');
        return { canClaim, reason: canClaim ? 'Eligible' : 'Not eligible' };
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

  // ============ GET BONUS LEVEL INFO (Issue #6: USDC as canonical, ETH from oracle) ============
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

      // Parse result (amountUSDC, active, claimsRemaining, minScore, requiresNFT)
      const hex = result.slice(2);
      const amountUSDC = BigInt('0x' + hex.slice(0, 64));
      const active = hex.slice(64, 128) !== '0'.repeat(64);
      const claimsRemaining = BigInt('0x' + hex.slice(128, 192));
      const minScore = BigInt('0x' + hex.slice(192, 256));
      const requiresNFT = hex.slice(256, 320) !== '0'.repeat(64);
      
      // Issue #6: Get oracle-derived ETH amount
      const amountETH = ethResult ? BigInt(ethResult) : 0n;

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
    } catch (error) {
      console.error('[BonusLevel] Fetch failed:', error);
      return null;
    }
  }, [formatUSDC]);

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
    mintNFT,
    batchMintNFT,
    quickMint,
    claimBonus,
    canClaimBonus,
    getBonusLevel,
    resetMintState,
    getMintPriceEstimate,
    getPriceInfo,
    checkBalance,
    // Issue #1: Expose oracle-based price functions
    getMintPriceETH,
    getBatchMintPriceETH,
    getMintPrice, // Legacy alias
    formatUSDC,
    getLevelProofMessage,
    contractAddress: NFT_CONTRACT_ADDRESS,
    supportsSponsorship: supportsWalletSendCalls(),
    // Issue #8: Expose anti-bot helpers
    checkRateLimit,
    canMint: !mintState.isMinting && !pendingOracleReadRef.current,
    canClaim: !mintState.isClaiming,
    isOracleReading: pendingOracleReadRef.current,
  };
}
