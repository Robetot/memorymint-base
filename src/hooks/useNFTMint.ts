import { useState, useCallback } from 'react';

// Update this after deploying MemoryMintOptimized.sol
const NFT_CONTRACT_ADDRESS = '0xA4952804C10a2eA5cF8ae0AD683364901186395b';

export interface MintState {
  isMinting: boolean;
  txHash: string | null;
  tokenId: string | null;
  error: string | null;
  success: boolean;
}

// Function selectors for optimized contract
const FUNCTION_SELECTORS = {
  // New optimized contract functions
  'mint()': '0x1249c58b',
  'safeMint()': '0xa0712d68',
  // Legacy contract functions (fallback)
  'safeMint(address,string)': '0xd204c45e',
  'mint(address,string)': '0xd85d3d27',
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

function encodeLegacyCallData(functionSig: string, address: string, tokenURI: string): string {
  const selector = FUNCTION_SELECTORS[functionSig as keyof typeof FUNCTION_SELECTORS];
  if (!selector) {
    console.error('Unknown function signature:', functionSig);
    return '';
  }
  
  const paddedAddress = padAddress(address);
  const stringOffset = '0000000000000000000000000000000000000000000000000000000000000040';
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

    // Verify chain is Base Mainnet
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
      console.log('Minting NFT on optimized contract...');
      console.log('Wallet:', walletAddress);
      
      // Try optimized mint() first (no parameters, lowest gas)
      let data = FUNCTION_SELECTORS['mint()'];
      let gasEstimate: string;
      let useOptimized = true;
      
      try {
        gasEstimate = await window.ethereum.request({
          method: 'eth_estimateGas',
          params: [{
            from: walletAddress,
            to: NFT_CONTRACT_ADDRESS,
            data,
          }],
        }) as string;
        console.log('Optimized mint() gas estimate:', gasEstimate);
      } catch (err) {
        console.log('Optimized contract not detected, falling back to legacy...');
        useOptimized = false;
        
        // Fallback to legacy contract with tokenURI
        data = encodeLegacyCallData('safeMint(address,string)', walletAddress, tokenURI);
        
        try {
          gasEstimate = await window.ethereum.request({
            method: 'eth_estimateGas',
            params: [{
              from: walletAddress,
              to: NFT_CONTRACT_ADDRESS,
              data,
            }],
          }) as string;
          console.log('Legacy safeMint gas estimate:', gasEstimate);
        } catch (err2) {
          // Try mint(address,string)
          data = encodeLegacyCallData('mint(address,string)', walletAddress, tokenURI);
          
          try {
            gasEstimate = await window.ethereum.request({
              method: 'eth_estimateGas',
              params: [{
                from: walletAddress,
                to: NFT_CONTRACT_ADDRESS,
                data,
              }],
            }) as string;
          } catch {
            // Use safe default
            gasEstimate = '0x15F90'; // 90,000 gas
          }
        }
      }

      // Add 20% buffer for safety
      const gasWithBuffer = '0x' + Math.floor(parseInt(gasEstimate, 16) * 1.2).toString(16);
      console.log('Final gas with buffer:', gasWithBuffer, `(${parseInt(gasWithBuffer, 16)} gas)`);

      // Build transaction with EIP-1559 for better pricing
      let txParams: Record<string, string> = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
        gas: gasWithBuffer,
      };

      try {
        const feeHistory = await window.ethereum.request({
          method: 'eth_feeHistory',
          params: ['0x1', 'latest', [25]],
        }) as { baseFeePerGas: string[]; reward: string[][] };
        
        if (feeHistory?.baseFeePerGas?.[0]) {
          const baseFee = parseInt(feeHistory.baseFeePerGas[0], 16);
          // Conservative: 1.3x base fee, minimal priority
          const maxPriorityFeePerGas = '0x5F5E100'; // 0.1 gwei
          const maxFeePerGas = '0x' + Math.floor(baseFee * 1.3).toString(16);
          
          txParams = {
            ...txParams,
            maxFeePerGas,
            maxPriorityFeePerGas,
          };
          console.log('EIP-1559 enabled, baseFee:', baseFee);
        }
      } catch {
        console.log('Using legacy transaction pricing');
      }
      
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }) as string;

      console.log('Transaction submitted:', txHash);
      console.log('Contract type:', useOptimized ? 'Optimized' : 'Legacy');
      setMintState(prev => ({ ...prev, txHash }));

      // Poll for confirmation
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
          // Continue polling
        }
        
        attempts++;
      }

      if (receipt) {
        const status = (receipt as { status: string }).status;
        if (status === '0x1') {
          const logs = (receipt as { logs: Array<{ topics: string[] }> }).logs;
          let tokenId = null;
          
          // Extract tokenId from Transfer event
          if (logs && logs.length > 0) {
            const transferLog = logs.find(log => 
              log.topics.length >= 4 && 
              log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
            );
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
        // Transaction pending but submitted successfully
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
      } else if ((error as { message?: string })?.message?.includes('OnePerBlock')) {
        errorMessage = 'Please wait for the next block (throttle active)';
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
