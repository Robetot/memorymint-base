import { useState, useCallback } from 'react';
import { encodeFunctionData, parseAbi } from 'viem';

// MemoryMint contract address on Base Mainnet
const NFT_CONTRACT_ADDRESS = '0xBf44A549C390923fD00B17E867804355E93Bf4c0';

// Minimal ABI needed for minting (works with MemoryMintPro/MemoryMintUltra)
const CONTRACT_ABI = parseAbi([
  'function mintNFT(string tokenURI) returns (uint256)',
  'function batchMint(uint256 quantity) returns (uint256)',
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

  const getEIP1559Params = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const feeHistory = await window.ethereum!.request({
        method: 'eth_feeHistory',
        params: ['0x1', 'latest', [25]],
      }) as { baseFeePerGas: string[]; reward: string[][] };
      
      if (feeHistory?.baseFeePerGas?.[0]) {
        const baseFee = parseInt(feeHistory.baseFeePerGas[0], 16);
        // Use a small priority fee and ensure maxFee is always larger
        const priorityFee = Math.max(1000000, Math.floor(baseFee * 0.1)); // ~0.001 gwei or 10% of base
        const maxFee = Math.max(baseFee * 2 + priorityFee, priorityFee * 2);
        return {
          maxPriorityFeePerGas: '0x' + priorityFee.toString(16),
          maxFeePerGas: '0x' + maxFee.toString(16),
        };
      }
    } catch {
      console.log('Fallback to legacy tx pricing');
    }
    return {};
  }, []);

  const waitForReceipt = useCallback(async (txHash: string): Promise<{ success: boolean; tokenIds: string[] }> => {
    let receipt = null;
    let attempts = 0;
    const maxAttempts = 60;

    while (!receipt && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
      return { success: true, tokenIds: [] }; // Pending but submitted
    }

    const status = (receipt as { status: string }).status;
    if (status !== '0x1') {
      throw new Error('Transaction failed on-chain');
    }

    // Extract all tokenIds from Transfer events
    const logs = (receipt as { logs: Array<{ topics: string[] }> }).logs;
    const tokenIds: string[] = [];
    
    if (logs?.length > 0) {
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      for (const log of logs) {
        if (log.topics.length >= 4 && log.topics[0] === transferTopic) {
          const tokenId = parseInt(log.topics[3], 16).toString();
          tokenIds.push(tokenId);
        }
      }
    }

    return { success: true, tokenIds };
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
      
      // Estimate gas (if this fails, the tx would revert)
      const gasEstimate = await window.ethereum.request({
        method: 'eth_estimateGas',
        params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
      }) as string;

      // Add 20% buffer
      const gas = '0x' + Math.floor(parseInt(gasEstimate, 16) * 1.2).toString(16);
      
      // Build EIP-1559 transaction
      const eipParams = await getEIP1559Params();
      const txParams = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
        gas,
        ...eipParams,
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }) as string;

      console.log('Transaction submitted:', txHash);
      setMintState(prev => ({ ...prev, txHash }));

      const { success, tokenIds } = await waitForReceipt(txHash);
      
      setMintState({
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
      });

      return success;
    } catch (error: unknown) {
      console.error('Minting error:', error);
      
      let errorMessage = 'Minting failed';
      if ((error as { code?: number })?.code === 4001) {
        errorMessage = 'Transaction rejected by user';
      } else if ((error as { message?: string })?.message?.includes('OnePerBlock')) {
        errorMessage = 'Please wait for the next block';
      } else if ((error as { message?: string })?.message?.includes('Paused')) {
        errorMessage = 'Minting is currently paused';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [verifyBaseNetwork, getEIP1559Params, waitForReceipt]);

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
      
      // Estimate gas (if this fails, the tx would revert)
      const gasEstimate = await window.ethereum.request({
        method: 'eth_estimateGas',
        params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
      }) as string;

      const gas = '0x' + Math.floor(parseInt(gasEstimate, 16) * 1.2).toString(16);
      
      const eipParams = await getEIP1559Params();
      const txParams = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
        gas,
        ...eipParams,
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }) as string;

      console.log('Batch transaction submitted:', txHash);
      setMintState(prev => ({ ...prev, txHash }));

      const { success, tokenIds } = await waitForReceipt(txHash);
      
      setMintState({
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
      });

      return success;
    } catch (error: unknown) {
      console.error('Batch minting error:', error);
      
      let errorMessage = 'Batch minting failed';
      if ((error as { code?: number })?.code === 4001) {
        errorMessage = 'Transaction rejected by user';
      } else if ((error as { message?: string })?.message?.includes('OnePerBlock')) {
        errorMessage = 'Please wait for the next block';
      } else if ((error as { message?: string })?.message?.includes('BatchTooLarge')) {
        errorMessage = 'Maximum 10 NFTs per batch';
      } else if ((error as { message?: string })?.message?.includes('Paused')) {
        errorMessage = 'Minting is currently paused';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [verifyBaseNetwork, getEIP1559Params, waitForReceipt]);

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
      
      const gasEstimate = await window.ethereum.request({
        method: 'eth_estimateGas',
        params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
      }) as string;

      const gas = '0x' + Math.floor(parseInt(gasEstimate, 16) * 1.2).toString(16);
      
      const eipParams = await getEIP1559Params();
      const txParams = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
        gas,
        ...eipParams,
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }) as string;

      console.log('Quick mint submitted:', txHash);
      setMintState(prev => ({ ...prev, txHash }));

      const { success, tokenIds } = await waitForReceipt(txHash);
      
      setMintState({
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        error: null,
        success,
      });

      return success;
    } catch (error: unknown) {
      console.error('Quick mint error:', error);
      
      let errorMessage = 'Quick mint failed';
      if ((error as { code?: number })?.code === 4001) {
        errorMessage = 'Transaction rejected by user';
      } else if ((error as { message?: string })?.message?.includes('OnePerBlock')) {
        errorMessage = 'Please wait for the next block';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setMintState(prev => ({
        ...prev,
        isMinting: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [verifyBaseNetwork, getEIP1559Params, waitForReceipt]);

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