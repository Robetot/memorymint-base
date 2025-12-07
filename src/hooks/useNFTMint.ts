import { useState, useCallback } from 'react';

const NFT_CONTRACT_ADDRESS = '0x73c505573E2A86f29eD0a990280477872b3c6c45';

export interface MintState {
  isMinting: boolean;
  txHash: string | null;
  tokenId: string | null;
  error: string | null;
  success: boolean;
}

// Pre-computed function selectors
const FUNCTION_SELECTORS: Record<string, string> = {
  'safeMint(address,string)': '0xd204c45e',
  'mint(address,string)': '0xd85d3d27',
  'mint(string)': '0xd0def521',
};

function padAddress(address: string): string {
  return address.toLowerCase().replace('0x', '').padStart(64, '0');
}

function encodeString(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const length = bytes.length.toString(16).padStart(64, '0');
  const paddedLength = Math.ceil(bytes.length / 32) * 32;
  
  let hexData = '';
  for (const byte of bytes) {
    hexData += byte.toString(16).padStart(2, '0');
  }
  hexData = hexData.padEnd(paddedLength * 2, '0');
  
  return length + hexData;
}

function encodeCallData(functionSig: string, address: string, tokenURI: string): string {
  const selector = FUNCTION_SELECTORS[functionSig];
  if (!selector) {
    console.error('Unknown function signature:', functionSig);
    return '';
  }
  
  // For safeMint(address,string) and mint(address,string)
  // Layout: selector + address (32 bytes) + string offset (32 bytes) + string data
  const paddedAddress = padAddress(address);
  const stringOffset = '0000000000000000000000000000000000000000000000000000000000000040'; // 64 in hex
  const stringData = encodeString(tokenURI);
  
  return selector + paddedAddress + stringOffset + stringData;
}

export function useNFTMint() {
  const [mintState, setMintState] = useState<MintState>({
    isMinting: false,
    txHash: null,
    tokenId: null,
    error: null,
    success: false,
  });

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

    // Verify chain
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      if (chainId.toLowerCase() !== '0x2105') {
        setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
        return false;
      }
    } catch (err) {
      console.error('Error checking chain:', err);
    }

    setMintState({
      isMinting: true,
      txHash: null,
      tokenId: null,
      error: null,
      success: false,
    });

    try {
      console.log('Minting NFT...');
      console.log('Address:', walletAddress);
      console.log('TokenURI length:', tokenURI.length);
      
      // Try safeMint(address,string) first - common pattern
      let data = encodeCallData('safeMint(address,string)', walletAddress, tokenURI);
      console.log('Using safeMint(address,string)');

      // Try to estimate gas
      let gasEstimate: string;
      let gasError: unknown = null;
      
      try {
        gasEstimate = await window.ethereum.request({
          method: 'eth_estimateGas',
          params: [{
            from: walletAddress,
            to: NFT_CONTRACT_ADDRESS,
            data,
          }],
        }) as string;
        console.log('Gas estimate successful:', gasEstimate);
      } catch (err) {
        gasError = err;
        console.log('safeMint failed, trying mint(address,string)...');
        
        // Try mint(address,string)
        data = encodeCallData('mint(address,string)', walletAddress, tokenURI);
        
        try {
          gasEstimate = await window.ethereum.request({
            method: 'eth_estimateGas',
            params: [{
              from: walletAddress,
              to: NFT_CONTRACT_ADDRESS,
              data,
            }],
          }) as string;
          console.log('mint(address,string) gas estimate:', gasEstimate);
          gasError = null;
        } catch (err2) {
          console.error('Both mint functions failed:', err2);
          // Use default gas
          gasEstimate = '0x4C4B40'; // 5000000
        }
      }

      if (gasError) {
        console.warn('Gas estimation failed, using default:', gasError);
      }

      console.log('Sending transaction with gas:', gasEstimate);
      
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: NFT_CONTRACT_ADDRESS,
          data,
          gas: gasEstimate,
        }],
      }) as string;

      console.log('Transaction submitted:', txHash);
      setMintState(prev => ({ ...prev, txHash }));

      // Wait for confirmation
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
          const logs = (receipt as { logs: Array<{ topics: string[] }> }).logs;
          let tokenId = null;
          
          if (logs && logs.length > 0) {
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
          throw new Error('Transaction failed on-chain');
        }
      } else {
        // Transaction pending but submitted
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
      console.error('Minting error:', error);
      
      let errorMessage = 'Minting failed';
      if ((error as { code?: number })?.code === 4001) {
        errorMessage = 'Transaction rejected by user';
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
  }, []);

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
