import { useState, useCallback } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult } from 'viem';

// MemoryMint contract address on Base Mainnet
const NFT_CONTRACT_ADDRESS = '0xBf44A549C390923fD00B17E867804355E93Bf4c0';

// Coinbase Paymaster URL for Base Mainnet (sponsored transactions)
const COINBASE_PAYMASTER_URL = 'https://api.developer.coinbase.com/rpc/v1/base/paymaster';

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

export interface MintState {
  isMinting: boolean;
  txHash: string | null;
  tokenId: string | null;
  tokenIds: string[] | null; // For batch mints
  error: string | null;
  success: boolean;
  isSponsored: boolean; // Whether gas was sponsored
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
  
  // Coinbase Smart Wallet / Base App supports wallet_sendCalls
  return !!(ethereum.isSmartWallet || ethereum.isPasskeyWallet || ethereum.isCoinbaseWallet);
}

// Get paymaster service URL based on environment
function getPaymasterServiceUrl(): string | null {
  // In production, use Coinbase Paymaster
  // Note: This requires the contract to be allowlisted on Coinbase Paymaster
  // For now, we'll attempt sponsorship and fallback to regular tx if it fails
  return COINBASE_PAYMASTER_URL;
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
  });

  const verifyBaseNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false;
    
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      return chainId.toLowerCase() === '0x2105';
    } catch {
      return false;
    }
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

      // Extract all tokenIds from Transfer events
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

  // Send sponsored transaction using EIP-5792 wallet_sendCalls
  const sendSponsoredTransaction = useCallback(async (
    walletAddress: string,
    data: `0x${string}`
  ): Promise<{ txHash: string; isSponsored: boolean }> => {
    const ethereum = window.ethereum as any;
    
    // Try sponsored transaction with wallet_sendCalls (EIP-5792)
    if (supportsWalletSendCalls()) {
      try {
        console.log('[Mint] Attempting sponsored transaction via wallet_sendCalls...');
        
        const calls = [{
          to: NFT_CONTRACT_ADDRESS,
          data,
          value: '0x0',
        }];

        // Try with paymaster capabilities
        const capabilities: Record<string, any> = {
          '0x2105': { // Base Mainnet
            paymasterService: {
              url: getPaymasterServiceUrl(),
            },
          },
        };

        try {
          // First try with paymaster sponsorship
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

          // Wait for the call to be processed and get the transaction hash
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
              // wallet_getCallsStatus might not be supported, fallback to polling receipt
              console.log('[Mint] wallet_getCallsStatus not available, using callId as txHash');
            }

            await new Promise(r => setTimeout(r, 2000));
            attempts++;
          }

          // If we got a callId but couldn't get status, treat callId as txHash
          if (callId && typeof callId === 'string' && callId.startsWith('0x')) {
            return { txHash: callId, isSponsored: true };
          }
        } catch (sponsorErr: any) {
          console.log('[Mint] Sponsored tx failed, falling back to regular tx:', sponsorErr?.message);
          // Fall through to regular transaction
        }
      } catch (err) {
        console.log('[Mint] wallet_sendCalls not supported, using eth_sendTransaction');
      }
    }

    // Fallback to regular eth_sendTransaction
    console.log('[Mint] Sending regular transaction via eth_sendTransaction...');
    const txHash = await ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
      }],
    }) as string;

    return { txHash, isSponsored: false };
  }, []);

  // Single NFT mint (game integration - uses safeMint with tokenURI)
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
    });

    try {
      console.log('[Mint] Minting NFT via MemoryMint...');
      const data = encodeMintNFTCallData(tokenURI);

      // Try sponsored transaction first, fallback to regular
      const { txHash, isSponsored } = await sendSponsoredTransaction(walletAddress, data);

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
      });

      if (success) {
        notifyMinted(walletAddress, tokenIds, txHash);
      }

      return success;
    } catch (error: unknown) {
      console.error('[Mint] Minting error:', error);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: decodeMintError(error),
      }));
      return false;
    }
  }, [notifyMinted, sendSponsoredTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  // Batch mint for power users
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
    });

    try {
      console.log(`[Mint] Batch minting ${quantity} NFTs...`);
      const data = encodeBatchMintCallData(quantity);

      // Try sponsored transaction first, fallback to regular
      const { txHash, isSponsored } = await sendSponsoredTransaction(walletAddress, data);

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
  }, [notifyMinted, sendSponsoredTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  // Quick mint (no tokenURI - uses contract's baseURI + tokenId)
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
    });

    try {
      console.log("[Mint] Quick minting via mintNFT('')...");
      const data = encodeMintNFTCallData('');

      // Try sponsored transaction first, fallback to regular
      const { txHash, isSponsored } = await sendSponsoredTransaction(walletAddress, data);

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
  }, [notifyMinted, sendSponsoredTransaction, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  const resetMintState = useCallback(() => {
    setMintState({
      isMinting: false,
      txHash: null,
      tokenId: null,
      tokenIds: null,
      error: null,
      success: false,
      isSponsored: false,
    });
  }, []);

  return {
    ...mintState,
    mintNFT,
    batchMintNFT,
    quickMint,
    resetMintState,
    contractAddress: NFT_CONTRACT_ADDRESS,
    supportsSponsorship: supportsWalletSendCalls(),
  };
}