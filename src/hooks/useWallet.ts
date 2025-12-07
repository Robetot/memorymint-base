import { useState, useCallback, useEffect } from 'react';

// Base Mainnet chain configuration
const BASE_CHAIN_ID = '0x2105'; // 8453 in hex
const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID,
  chainName: 'Base',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

export type WalletType = 'metamask' | 'coinbase';

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  walletType: WalletType | null;
  chainId: string | null;
  isCorrectChain: boolean;
  error: string | null;
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export function useWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
    address: null,
    walletType: null,
    chainId: null,
    isCorrectChain: false,
    error: null,
  });

  const checkChain = useCallback(async () => {
    if (!window.ethereum) return false;
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      const isCorrect = chainId.toLowerCase() === BASE_CHAIN_ID.toLowerCase();
      setWalletState(prev => ({ ...prev, chainId, isCorrectChain: isCorrect }));
      return isCorrect;
    } catch {
      return false;
    }
  }, []);

  const switchToBase = useCallback(async () => {
    if (!window.ethereum) return false;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID }],
      });
      return true;
    } catch (switchError: unknown) {
      // Chain not added, try to add it
      if ((switchError as { code?: number })?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BASE_CHAIN_CONFIG],
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }, []);

  const connectWallet = useCallback(async (walletType: WalletType) => {
    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      if (!window.ethereum) {
        const walletUrl = walletType === 'metamask' 
          ? 'https://metamask.io/download/' 
          : 'https://www.coinbase.com/wallet';
        setWalletState(prev => ({
          ...prev,
          isConnecting: false,
          error: `Please install ${walletType === 'metamask' ? 'MetaMask' : 'Coinbase Wallet'} first`,
        }));
        window.open(walletUrl, '_blank');
        return false;
      }

      // Request accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      
      // Check and switch to Base chain
      const isCorrectChain = await checkChain();
      if (!isCorrectChain) {
        const switched = await switchToBase();
        if (!switched) {
          setWalletState(prev => ({
            ...prev,
            isConnecting: false,
            error: 'Please switch to Base network',
          }));
          return false;
        }
      }

      setWalletState({
        isConnected: true,
        isConnecting: false,
        address,
        walletType,
        chainId: BASE_CHAIN_ID,
        isCorrectChain: true,
        error: null,
      });

      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [checkChain, switchToBase]);

  const disconnectWallet = useCallback(() => {
    setWalletState({
      isConnected: false,
      isConnecting: false,
      address: null,
      walletType: null,
      chainId: null,
      isCorrectChain: false,
      error: null,
    });
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        disconnectWallet();
      } else if (walletState.isConnected) {
        setWalletState(prev => ({ ...prev, address: accs[0] }));
      }
    };

    const handleChainChanged = () => {
      checkChain();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [walletState.isConnected, disconnectWallet, checkChain]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return {
    ...walletState,
    connectWallet,
    disconnectWallet,
    switchToBase,
    formatAddress,
  };
}
