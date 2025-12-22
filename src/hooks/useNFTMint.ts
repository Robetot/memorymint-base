import { useState, useCallback, useRef } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult } from 'viem';

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

// ============ CONTRACT ABI ============
// Minimal ABI for MemoryMintFeeAware
const CONTRACT_ABI = parseAbi([
  'function mintNFT(string tokenURI) payable returns (uint256)',
  'function batchMint(uint256 quantity) payable returns (uint256)',
  'function mintPrice() view returns (uint256)',
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
]);

// ============ TYPES ============
export interface MintState {
  isMinting: boolean;
  txHash: string | null;
  tokenId: string | null;
  tokenIds: string[] | null;
  error: string | null;
  success: boolean;
  isSponsored: boolean;
  mintPriceEth: string | null;
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
        default:
          return `Mint failed: ${decoded.errorName}`;
      }
    } catch {
      // Fall through to generic message
    }
  }

  const rawMsg: string | undefined = err?.data?.message || err?.error?.message || err?.message;
  if (rawMsg) {
    // Clean up common error messages
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
    txHash: null,
    tokenId: null,
    tokenIds: null,
    error: null,
    success: false,
    isSponsored: false,
    mintPriceEth: null,
  });
  
  // Prevent double-minting on retries
  const pendingMintRef = useRef<string | null>(null);

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

  // ============ READ MINT PRICE FROM CONTRACT ============
  const getMintPrice = useCallback(async (): Promise<bigint> => {
    try {
      // Encode mintPrice() call
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'mintPrice',
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
      console.error('[Mint] Failed to read mintPrice:', error);
      return BigInt(0); // Default to free if read fails
    }
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

  // ============ SEND TRANSACTION ============
  const sendMintTransaction = useCallback(async (
    walletAddress: string,
    data: `0x${string}`,
    valueWei: bigint
  ): Promise<{ txHash: string; isSponsored: boolean }> => {
    const ethereum = window.ethereum as any;
    const valueHex = valueWei > 0n ? '0x' + valueWei.toString(16) : '0x0';
    
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
    }

    // Fallback to regular eth_sendTransaction
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
  }, []);

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

    // Prevent double-minting
    const mintKey = `${walletAddress}-${Date.now()}`;
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
      mintPriceEth: null,
    });

    try {
      // Read current mint price from contract
      console.log('[Mint] Reading mintPrice from contract...');
      const mintPriceWei = await getMintPrice();
      const mintPriceEth = formatWeiToEth(mintPriceWei);
      
      console.log(`[Mint] Mint price: ${mintPriceEth} ETH (${mintPriceWei === 0n ? 'FREE' : 'paid'})`);
      setMintState(prev => ({ ...prev, mintPriceEth }));

      // Encode mint call
      const data = encodeMintNFTCallData(tokenURI);

      // Send transaction with value = mintPrice
      const { txHash, isSponsored } = await sendMintTransaction(walletAddress, data, mintPriceWei);

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
        mintPriceEth,
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
  }, [getMintPrice, notifyMinted, sendMintTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

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
      mintPriceEth: null,
    });

    try {
      // Read current mint price from contract
      console.log('[Mint] Reading mintPrice for batch...');
      const mintPriceWei = await getMintPrice();
      const totalPriceWei = mintPriceWei * BigInt(quantity);
      const mintPriceEth = formatWeiToEth(totalPriceWei);
      
      console.log(`[Mint] Batch mint price: ${mintPriceEth} ETH for ${quantity} NFTs`);
      setMintState(prev => ({ ...prev, mintPriceEth }));

      // Encode batch mint call
      const data = encodeBatchMintCallData(quantity);

      // Send transaction with value = mintPrice * quantity
      const { txHash, isSponsored } = await sendMintTransaction(walletAddress, data, totalPriceWei);

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
        mintPriceEth,
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
  }, [getMintPrice, notifyMinted, sendMintTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  // ============ QUICK MINT (empty tokenURI) ============
  const quickMint = useCallback(async (walletAddress: string): Promise<boolean> => {
    return mintNFT('', walletAddress);
  }, [mintNFT]);

  // ============ RESET STATE ============
  const resetMintState = useCallback(() => {
    setMintState({
      isMinting: false,
      txHash: null,
      tokenId: null,
      tokenIds: null,
      error: null,
      success: false,
      isSponsored: false,
      mintPriceEth: null,
    });
    pendingMintRef.current = null;
  }, []);

  // ============ GET MINT PRICE ESTIMATE ============
  const getMintPriceEstimate = useCallback(async (quantity: number = 1): Promise<{ priceWei: bigint; priceEth: string; isFree: boolean } | null> => {
    try {
      const mintPriceWei = await getMintPrice();
      const totalWei = mintPriceWei * BigInt(quantity);
      return {
        priceWei: totalWei,
        priceEth: formatWeiToEth(totalWei),
        isFree: mintPriceWei === 0n,
      };
    } catch {
      return null;
    }
  }, [getMintPrice]);

  // ============ CHECK BALANCE ============
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

      // Get mint price from contract
      const mintPriceWei = await getMintPrice();
      const totalMintPriceWei = mintPriceWei * BigInt(quantity);
      
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
  }, [getMintPrice]);

  return {
    ...mintState,
    mintNFT,
    batchMintNFT,
    quickMint,
    resetMintState,
    getMintPriceEstimate,
    checkBalance,
    getMintPrice,
    contractAddress: NFT_CONTRACT_ADDRESS,
    supportsSponsorship: supportsWalletSendCalls(),
  };
}
