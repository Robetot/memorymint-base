import { useState, useCallback } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult } from 'viem';

// MemoryMint contract address on Base Mainnet
const NFT_CONTRACT_ADDRESS = '0xBf44A549C390923fD00B17E867804355E93Bf4c0';

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

export function useNFTMint() {
  const [mintState, setMintState] = useState<MintState>({
    isMinting: false,
    txHash: null,
    tokenId: null,
    tokenIds: null,
    error: null,
    success: false,
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
    });

    try {
      console.log('Minting NFT via MemoryMint...');

      // Mint using mintNFT(string)
      const data = encodeMintNFTCallData(tokenURI);

      // IMPORTANT: do NOT set a padded gasLimit; it inflates the wallet UI fee display.
      // Let the wallet estimate gas + fees accurately on Base.
      const txParams = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
      };

      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      })) as string;

      console.log('Transaction submitted:', txHash);
      setMintState(prev => ({ ...prev, txHash }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      setMintState({
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
      });

      if (success) {
        notifyMinted(walletAddress, tokenIds, txHash);
      }

      return success;
    } catch (error: unknown) {
      console.error('Minting error:', error);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: decodeMintError(error),
      }));
      return false;
    }
  }, [notifyMinted, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);


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
    });

    try {
      console.log(`Batch minting ${quantity} NFTs...`);

      const data = encodeBatchMintCallData(quantity);

      // Let wallet estimate gas + fees (no padded gasLimit)
      const txParams = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
      };

      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      })) as string;

      console.log('Batch transaction submitted:', txHash);
      setMintState(prev => ({ ...prev, txHash }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      setMintState({
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
      });

      if (success) {
        notifyMinted(walletAddress, tokenIds, txHash);
      }

      return success;
    } catch (error: unknown) {
      console.error('Batch minting error:', error);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: decodeMintError(error),
      }));
      return false;
    }
  }, [notifyMinted, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

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
    });

    try {
      console.log("Quick minting via mintNFT('')...");

      const data = encodeMintNFTCallData('');

      // Let wallet estimate gas + fees (no padded gasLimit)
      const txParams = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
      };

      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      })) as string;

      console.log('Quick mint submitted:', txHash);
      setMintState(prev => ({ ...prev, txHash }));

      const { success, tokenIds, blockNumber } = await waitForReceipt(txHash);
      await waitForOneConfirmation(blockNumber);

      setMintState({
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
      });

      if (success) {
        notifyMinted(walletAddress, tokenIds, txHash);
      }

      return success;
    } catch (error: unknown) {
      console.error('Quick mint error:', error);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: decodeMintError(error),
      }));
      return false;
    }
  }, [notifyMinted, verifyBaseNetwork, waitForOneConfirmation, waitForReceipt]);

  const resetMintState = useCallback(() => {
    setMintState({
      isMinting: false,
      txHash: null,
      tokenId: null,
      tokenIds: null,
      error: null,
      success: false,
    });
  }, []);

  return {
    ...mintState,
    mintNFT,
    batchMintNFT,
    quickMint,
    resetMintState,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}