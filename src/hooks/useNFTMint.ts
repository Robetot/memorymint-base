import { useState, useCallback } from 'react';
import { useWallet } from './useWallet';

const NFT_CONTRACT_ADDRESS = '0x73c505573E2A86f29eD0a990280477872b3c6c45';

// Minimal ERC721 ABI for minting
const MINT_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenURI', type: 'string' }
    ],
    name: 'mint',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [{ name: 'tokenURI', type: 'string' }],
    name: 'safeMint',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
];

export interface MintState {
  isMinting: boolean;
  txHash: string | null;
  tokenId: string | null;
  error: string | null;
  success: boolean;
}

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

function encodeABI(method: string, params: unknown[]): string {
  // Simple ABI encoding for mint function
  const methodSignature = method === 'safeMint' 
    ? 'safeMint(string)' 
    : 'mint(address,string)';
  
  // Calculate function selector (first 4 bytes of keccak256 hash)
  const selector = keccak256(methodSignature).slice(0, 10);
  
  if (method === 'safeMint') {
    const [tokenURI] = params as [string];
    const encoded = encodeString(tokenURI);
    return selector + encoded;
  } else {
    const [to, tokenURI] = params as [string, string];
    const addressEncoded = to.toLowerCase().replace('0x', '').padStart(64, '0');
    const stringOffset = '0000000000000000000000000000000000000000000000000000000000000040';
    const stringEncoded = encodeString(tokenURI);
    return selector + addressEncoded + stringOffset + stringEncoded;
  }
}

function encodeString(str: string): string {
  const utf8 = new TextEncoder().encode(str);
  const length = utf8.length.toString(16).padStart(64, '0');
  const paddedLength = Math.ceil(utf8.length / 32) * 32;
  const data = Array.from(utf8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .padEnd(paddedLength * 2, '0');
  return length + data;
}

// Simple keccak256 function selector calculation
function keccak256(input: string): string {
  // Pre-computed selectors for our methods
  const selectors: Record<string, string> = {
    'mint(address,string)': '0xd85d3d27',
    'safeMint(string)': '0xa1448194',
  };
  return selectors[input] || '0x00000000';
}

export function useNFTMint() {
  const { isConnected, address, isCorrectChain } = useWallet();
  const [mintState, setMintState] = useState<MintState>({
    isMinting: false,
    txHash: null,
    tokenId: null,
    error: null,
    success: false,
  });

  const createMetadata = useCallback((
    imageUrl: string,
    score: number,
    rarity: string,
    prompt: string,
    style: string
  ): NFTMetadata => {
    return {
      name: `MemoryMint #${Date.now()}`,
      description: `A skill-based NFT from MemoryMint. Created with prompt: "${prompt}"`,
      image: imageUrl,
      attributes: [
        { trait_type: 'Score', value: score },
        { trait_type: 'Rarity', value: rarity },
        { trait_type: 'Art Style', value: style },
        { trait_type: 'Created', value: new Date().toISOString() },
      ],
    };
  }, []);

  const mintNFT = useCallback(async (
    imageUrl: string,
    score: number,
    rarity: string,
    prompt: string,
    style: string
  ): Promise<boolean> => {
    if (!isConnected || !address) {
      setMintState(prev => ({
        ...prev,
        error: 'Wallet not connected',
      }));
      return false;
    }

    if (!isCorrectChain) {
      setMintState(prev => ({
        ...prev,
        error: 'Please switch to Base network',
      }));
      return false;
    }

    if (!window.ethereum) {
      setMintState(prev => ({
        ...prev,
        error: 'No wallet detected',
      }));
      return false;
    }

    setMintState({
      isMinting: true,
      txHash: null,
      tokenId: null,
      error: null,
      success: false,
    });

    try {
      // Create metadata
      const metadata = createMetadata(imageUrl, score, rarity, prompt, style);
      
      // For now, we'll use the image URL directly as the tokenURI
      // In production, you'd upload metadata to IPFS first
      const tokenURI = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;

      // Encode the transaction data
      const data = encodeABI('safeMint', [tokenURI]);

      // Estimate gas
      let gasEstimate: string;
      try {
        gasEstimate = await window.ethereum.request({
          method: 'eth_estimateGas',
          params: [{
            from: address,
            to: NFT_CONTRACT_ADDRESS,
            data,
          }],
        }) as string;
      } catch {
        // Default gas limit if estimation fails
        gasEstimate = '0x186A0'; // 100000
      }

      // Send transaction
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: NFT_CONTRACT_ADDRESS,
          data,
          gas: gasEstimate,
        }],
      }) as string;

      setMintState(prev => ({
        ...prev,
        txHash,
      }));

      // Wait for transaction receipt
      let receipt = null;
      let attempts = 0;
      const maxAttempts = 60;

      while (!receipt && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          receipt = await window.ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
        } catch {
          // Continue waiting
        }
        
        attempts++;
      }

      if (receipt) {
        const status = (receipt as { status: string }).status;
        if (status === '0x1') {
          // Extract token ID from logs if available
          const logs = (receipt as { logs: Array<{ topics: string[] }> }).logs;
          let tokenId = null;
          
          if (logs && logs.length > 0) {
            // Token ID is typically in the third topic of Transfer event
            const transferLog = logs.find(log => log.topics.length >= 4);
            if (transferLog) {
              tokenId = parseInt(transferLog.topics[3], 16).toString();
            }
          }

          setMintState({
            isMinting: false,
            txHash,
            tokenId,
            error: null,
            success: true,
          });
          return true;
        } else {
          throw new Error('Transaction failed');
        }
      } else {
        // Transaction submitted but not yet confirmed
        setMintState({
          isMinting: false,
          txHash,
          tokenId: null,
          error: null,
          success: true,
        });
        return true;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Minting failed';
      
      // Handle user rejection
      if ((error as { code?: number })?.code === 4001) {
        setMintState(prev => ({
          ...prev,
          isMinting: false,
          error: 'Transaction rejected by user',
        }));
      } else {
        setMintState(prev => ({
          ...prev,
          isMinting: false,
          error: errorMessage,
        }));
      }
      return false;
    }
  }, [isConnected, address, isCorrectChain, createMetadata]);

  const resetMintState = useCallback(() => {
    setMintState({
      isMinting: false,
      txHash: null,
      tokenId: null,
      error: null,
      success: false,
    });
  }, []);

  return {
    ...mintState,
    mintNFT,
    resetMintState,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
