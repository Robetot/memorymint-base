import { useState, useCallback, useRef } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult } from 'viem';

// MemoryMint contract address on Base Mainnet
const NFT_CONTRACT_ADDRESS = '0xBf44A549C390923fD00B17E867804355E93Bf4c0';

// Treasury address for AI fee collection
const TREASURY_ADDRESS = '0x9153f77e298c418288818cb2ac2543292ef4f4d2';

// AI generation fee in USD
const AI_FEE_USD = 0.04;

// Coinbase Paymaster URL for Base Mainnet (sponsored transactions)
const COINBASE_PAYMASTER_URL = 'https://api.developer.coinbase.com/rpc/v1/base/paymaster';

// Price cache duration (1 minute)
const PRICE_CACHE_DURATION = 60000;

// Minimal ABI needed for minting (works with MemoryMintUltra)
const CONTRACT_ABI = parseAbi([
  'function mintNFT(string tokenURI) returns (uint256)',
  'function batchMint(uint256 quantity) returns (uint256)',
]);

// Custom errors (for precise UX messaging)
const CONTRACT_ERROR_ABI = parseAbi([
  'error Paused()',
  'error AlreadyMinted()',
  'error InvalidQuantity()',
  'error MaxBatchExceeded()',
  'error TransferToNonReceiver()',
  'error ReentrancyGuard()',
  'error MetadataFrozen()',
  'error NotOwner()',
  'error ZeroAddress()',
  'error TokenNotExist()',
  'error NotApproved()',
  'error NotAuthorized()',
  'error NameAlreadySet()',
  'error EmptyName()',
]);

// Price cache
let priceCache: { price: number; timestamp: number } | null = null;

// Estimated gas cost in ETH (conservative estimate for Base)
const ESTIMATED_GAS_ETH = 0.0002;

export interface MintState {
  isMinting: boolean;
  txHash: string | null;
  tokenId: string | null;
  tokenIds: string[] | null;
  error: string | null;
  success: boolean;
  isSponsored: boolean;
  aiFeeEth: string | null;
}

export interface BalanceCheck {
  hasEnough: boolean;
  balance: string;
  required: string;
  shortfall: string | null;
}

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

  if (err?.code === 4001) return 'Transaction rejected by user';

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
        case 'Paused':
          return 'Minting is currently paused';
        case 'AlreadyMinted':
          return 'Please wait a moment and try again (mint throttle)';
        case 'InvalidQuantity':
        case 'MaxBatchExceeded':
          return 'Batch size must be 1–10';
        case 'TransferToNonReceiver':
          return 'Recipient cannot receive ERC-721 tokens';
        case 'ReentrancyGuard':
          return 'Please retry (temporary mint lock)';
        default:
          return `Mint failed: ${decoded.errorName}`;
      }
    } catch {
      // fall through
    }
  }

  const rawMsg: string | undefined = err?.data?.message || err?.error?.message || err?.message;
  if (rawMsg) return rawMsg;
  return 'Minting failed';
}

// Detect if wallet supports sponsored transactions (EIP-5792)
function supportsWalletSendCalls(): boolean {
  const ethereum = window.ethereum as any;
  if (!ethereum) return false;
  
  return !!(ethereum.isSmartWallet || ethereum.isPasskeyWallet || ethereum.isCoinbaseWallet);
}

// Get paymaster service URL based on environment
function getPaymasterServiceUrl(): string | null {
  return COINBASE_PAYMASTER_URL;
}

// Fetch ETH price with caching
async function fetchEthPrice(): Promise<number> {
  // Check cache first
  if (priceCache && Date.now() - priceCache.timestamp < PRICE_CACHE_DURATION) {
    return priceCache.price;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch ETH price');
    }

    const data = await response.json();
    const ethPrice = data.ethereum.usd;

    if (!ethPrice || ethPrice <= 0) {
      throw new Error('Invalid ETH price');
    }

    // Update cache
    priceCache = { price: ethPrice, timestamp: Date.now() };
    return ethPrice;
  } catch (error) {
    // Use cached price as fallback
    if (priceCache) {
      return priceCache.price;
    }
    throw new Error('Unable to fetch ETH price');
  }
}

// Calculate AI fee in wei
function calculateAiFeeWei(ethPrice: number, quantity: number = 1): bigint {
  const totalFeeUsd = AI_FEE_USD * quantity;
  const aiFeeEth = totalFeeUsd / ethPrice;
  // Round up to avoid underpayment
  return BigInt(Math.ceil(aiFeeEth * 1e18));
}

// Format wei to ETH string
function formatWeiToEth(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(6);
}

export function useNFTMint() {
  const [mintState, setMintState] = useState<MintState>({
    isMinting: false,
    txHash: null,
    tokenId: null,
    tokenIds: null,
    error: null,
    success: false,
    isSponsored: false,
    aiFeeEth: null,
  });
  
  // Prevent double-charging on retries
  const pendingMintRef = useRef<string | null>(null);

  const verifyBaseNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false;
    
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      return chainId.toLowerCase() === '0x2105';
    } catch {
      return false;
    }
  }, []);

  // Calculate AI fee in wei (included in mint transaction value)
  const getAiFeeWei = useCallback(async (quantity: number = 1): Promise<bigint> => {
    const ethPrice = await fetchEthPrice();
    return calculateAiFeeWei(ethPrice, quantity);
  }, []);

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
        throw new Error('Transaction is still pending. Please wait for confirmation and try again.');
      }

      const status = receipt.status as string;
      if (status !== '0x1') {
        throw new Error('Transaction failed on-chain');
      }

      const logs = (receipt.logs as Array<{ topics: string[] }>) || [];
      const tokenIds: string[] = [];

      if (logs.length > 0) {
        const transferTopic =
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

        for (const log of logs) {
          if (log.topics.length >= 4 && log.topics[0] === transferTopic) {
            const tokenId = parseInt(log.topics[3], 16).toString();
            tokenIds.push(tokenId);
          }
        }
      }

      return { success: true, tokenIds, blockNumber: receipt.blockNumber as string | undefined };
    },
    []
  );

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
        // ignore
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, []);

  const notifyMinted = useCallback((walletAddress: string, tokenIds: string[], txHash: string) => {
    window.dispatchEvent(
      new CustomEvent('memorymint:nft-minted', {
        detail: {
          address: walletAddress,
          tokenIds,
          txHash,
        },
      })
    );
  }, []);

  // Send transaction with AI fee included in value (single transaction)
  const sendMintTransaction = useCallback(async (
    walletAddress: string,
    data: `0x${string}`,
    valueWei: bigint
  ): Promise<{ txHash: string; isSponsored: boolean }> => {
    const ethereum = window.ethereum as any;
    const valueHex = '0x' + valueWei.toString(16);
    
    // Try sponsored transaction with wallet_sendCalls (EIP-5792)
    if (supportsWalletSendCalls()) {
      try {
        console.log('[Mint] Attempting sponsored transaction via wallet_sendCalls...');
        
        const calls = [{
          to: NFT_CONTRACT_ADDRESS,
          data,
          value: valueHex,
        }];

        const capabilities: Record<string, any> = {
          '0x2105': {
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
              chainId: '0x2105',
              from: walletAddress,
              calls,
              capabilities,
            }],
          });

          console.log('[Mint] wallet_sendCalls submitted:', callId);

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
                return { 
                  txHash: status.receipts[0].transactionHash, 
                  isSponsored: true 
                };
              }

              if (status?.status === 'FAILED') {
                throw new Error(status?.reason || 'Sponsored transaction failed');
              }
            } catch (statusErr) {
              console.log('[Mint] wallet_getCallsStatus not available, using callId as txHash');
            }

            await new Promise(r => setTimeout(r, 2000));
            attempts++;
          }

          if (callId && typeof callId === 'string' && callId.startsWith('0x')) {
            return { txHash: callId, isSponsored: true };
          }
        } catch (sponsorErr: any) {
          console.log('[Mint] Sponsored tx failed, falling back to regular tx:', sponsorErr?.message);
        }
      } catch (err) {
        console.log('[Mint] wallet_sendCalls not supported, using eth_sendTransaction');
      }
    }

    // Fallback to regular eth_sendTransaction with value
    console.log('[Mint] Sending regular transaction via eth_sendTransaction...');
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
  }, []);

  // Single NFT mint with AI fee included in transaction value
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

    // Prevent double-charging
    const mintKey = `${walletAddress}-${tokenURI}-${Date.now()}`;
    if (pendingMintRef.current === mintKey) {
      return false;
    }
    pendingMintRef.current = mintKey;

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
      pendingMintRef.current = null;
      return false;
    }

    setMintState({
      isMinting: true,
      txHash: null,
      tokenId: null,
      tokenIds: null,
      error: null,
      success: false,
      isSponsored: false,
      aiFeeEth: null,
    });

    try {
      // Calculate AI fee to include in transaction value
      console.log('[Mint] Calculating AI fee...');
      const aiFeeWei = await getAiFeeWei(1);
      const aiFeeEth = formatWeiToEth(aiFeeWei);
      
      console.log(`[Mint] AI fee included in tx value: $${AI_FEE_USD} = ${aiFeeEth} ETH`);
      setMintState(prev => ({ ...prev, aiFeeEth }));

      // Mint NFT with AI fee included in transaction value (single transaction)
      console.log('[Mint] Minting NFT via MemoryMint...');
      const data = encodeMintNFTCallData(tokenURI);

      const { txHash, isSponsored } = await sendMintTransaction(walletAddress, data, aiFeeWei);

      console.log('[Mint] Transaction submitted:', txHash, isSponsored ? '(SPONSORED)' : '');
      setMintState(prev => ({ ...prev, txHash, isSponsored }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      setMintState({
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
        isSponsored,
        aiFeeEth,
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
  }, [getAiFeeWei, notifyMinted, sendMintTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  // Batch mint with AI fee included in transaction value
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

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
      return false;
    }

    setMintState({
      isMinting: true,
      txHash: null,
      tokenId: null,
      tokenIds: null,
      error: null,
      success: false,
      isSponsored: false,
      aiFeeEth: null,
    });

    try {
      // Calculate AI fee for batch to include in transaction value
      console.log('[Mint] Calculating batch AI fee...');
      const aiFeeWei = await getAiFeeWei(quantity);
      const aiFeeEth = formatWeiToEth(aiFeeWei);
      
      console.log(`[Mint] Batch AI fee included in tx value: $${AI_FEE_USD * quantity} = ${aiFeeEth} ETH for ${quantity} NFTs`);
      setMintState(prev => ({ ...prev, aiFeeEth }));

      // Batch mint NFTs with AI fee included in transaction value (single transaction)
      console.log(`[Mint] Batch minting ${quantity} NFTs...`);
      const data = encodeBatchMintCallData(quantity);

      const { txHash, isSponsored } = await sendMintTransaction(walletAddress, data, aiFeeWei);

      console.log('[Mint] Batch transaction submitted:', txHash, isSponsored ? '(SPONSORED)' : '');
      setMintState(prev => ({ ...prev, txHash, isSponsored }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      setMintState({
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
        isSponsored,
        aiFeeEth,
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
  }, [getAiFeeWei, notifyMinted, sendMintTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  // Quick mint with AI fee included in transaction value
  const quickMint = useCallback(async (walletAddress: string): Promise<boolean> => {
    if (!window.ethereum) {
      setMintState(prev => ({ ...prev, error: 'No wallet detected' }));
      return false;
    }

    if (!walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
      return false;
    }

    setMintState({
      isMinting: true,
      txHash: null,
      tokenId: null,
      tokenIds: null,
      error: null,
      success: false,
      isSponsored: false,
      aiFeeEth: null,
    });

    try {
      // Calculate AI fee to include in transaction value
      console.log('[Mint] Calculating AI fee...');
      const aiFeeWei = await getAiFeeWei(1);
      const aiFeeEth = formatWeiToEth(aiFeeWei);
      
      console.log(`[Mint] AI fee included in tx value: $${AI_FEE_USD} = ${aiFeeEth} ETH`);
      setMintState(prev => ({ ...prev, aiFeeEth }));

      // Quick mint with AI fee included in transaction value (single transaction)
      console.log("[Mint] Quick minting via mintNFT('')...");
      const data = encodeMintNFTCallData('');

      const { txHash, isSponsored } = await sendMintTransaction(walletAddress, data, aiFeeWei);

      console.log('[Mint] Quick mint submitted:', txHash, isSponsored ? '(SPONSORED)' : '');
      setMintState(prev => ({ ...prev, txHash, isSponsored }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      setMintState({
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
        isSponsored,
        aiFeeEth,
      });

      if (success) {
        notifyMinted(walletAddress, tokenIds, txHash);
      }

      return success;
    } catch (error: unknown) {
      console.error('[Mint] Quick mint error:', error);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: decodeMintError(error),
      }));
      return false;
    }
  }, [getAiFeeWei, notifyMinted, sendMintTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  const resetMintState = useCallback(() => {
    setMintState({
      isMinting: false,
      txHash: null,
      tokenId: null,
      tokenIds: null,
      error: null,
      success: false,
      isSponsored: false,
      aiFeeEth: null,
    });
    pendingMintRef.current = null;
  }, []);

  // Get current AI fee estimate
  const getAiFeeEstimate = useCallback(async (quantity: number = 1): Promise<{ feeUsd: number; feeEth: string } | null> => {
    try {
      const ethPrice = await fetchEthPrice();
      const aiFeeWei = calculateAiFeeWei(ethPrice, quantity);
      return {
        feeUsd: AI_FEE_USD * quantity,
        feeEth: formatWeiToEth(aiFeeWei),
      };
    } catch {
      return null;
    }
  }, []);

  // Check if user has enough balance for AI fee + gas
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

      // Calculate required amount (AI fee + estimated gas)
      const ethPrice = await fetchEthPrice();
      const aiFeeWei = calculateAiFeeWei(ethPrice, quantity);
      const aiFeeEth = Number(aiFeeWei) / 1e18;
      const requiredEth = aiFeeEth + ESTIMATED_GAS_ETH;

      const hasEnough = balanceEth >= requiredEth;
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
  }, []);

  return {
    ...mintState,
    mintNFT,
    batchMintNFT,
    quickMint,
    resetMintState,
    getAiFeeEstimate,
    checkBalance,
    contractAddress: NFT_CONTRACT_ADDRESS,
    treasuryAddress: TREASURY_ADDRESS,
    aiFeeUsd: AI_FEE_USD,
    estimatedGasEth: ESTIMATED_GAS_ETH,
    supportsSponsorship: supportsWalletSendCalls(),
  };
}
