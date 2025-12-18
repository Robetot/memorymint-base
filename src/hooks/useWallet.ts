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

export type WalletType = 'metamask' | 'coinbase' | 'baseapp';

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  walletType: WalletType | null;
  chainId: string | null;
  isCorrectChain: boolean;
  error: string | null;
  isSmartWallet: boolean;
  isBaseApp: boolean;
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isSmartWallet?: boolean;
      isPasskeyWallet?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

// Detect if running in Base App environment
function detectBaseApp(): boolean {
  if (typeof window === 'undefined' || !window.ethereum) return false;
  
  const ethereum = window.ethereum;
  
  // Check for smart wallet indicators (Base App uses smart wallets)
  if (ethereum.isSmartWallet || ethereum.isPasskeyWallet) {
    return true;
  }
  
  // Check user agent for Base/Coinbase indicators
  const userAgent = navigator.userAgent.toLowerCase();
  if (ethereum.isCoinbaseWallet && (userAgent.includes('base') || userAgent.includes('coinbase'))) {
    return true;
  }
  
  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('baseapp') || urlParams.get('source') === 'baseapp') {
    return true;
  }
  
  return false;
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
    isSmartWallet: false,
    isBaseApp: false,
  });

  // Detect Base App on mount
  useEffect(() => {
    const isBaseApp = detectBaseApp();
    setWalletState(prev => ({ ...prev, isBaseApp }));
    
    // Auto-connect if in Base App
    if (isBaseApp && window.ethereum) {
      checkExistingConnection();
    }
  }, []);

  const checkExistingConnection = async () => {
    if (!window.ethereum) return;
    
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
      if (accounts && accounts.length > 0) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
        const isCorrect = chainId.toLowerCase() === BASE_CHAIN_ID.toLowerCase();
        const isSmartWallet = !!(window.ethereum.isSmartWallet || window.ethereum.isPasskeyWallet);
        
        setWalletState(prev => ({
          ...prev,
          isConnected: true,
          address: accounts[0],
          walletType: prev.isBaseApp ? 'baseapp' : (window.ethereum?.isCoinbaseWallet ? 'coinbase' : 'metamask'),
          chainId,
          isCorrectChain: isCorrect,
          isSmartWallet,
        }));
      }
    } catch (err) {
      console.log('No existing wallet connection');
    }
  };

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
      setWalletState(prev => ({ ...prev, chainId: BASE_CHAIN_ID, isCorrectChain: true }));
      return true;
    } catch (switchError: unknown) {
      // Chain not added, try to add it
      if ((switchError as { code?: number })?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BASE_CHAIN_CONFIG],
          });
          setWalletState(prev => ({ ...prev, chainId: BASE_CHAIN_ID, isCorrectChain: true }));
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
        // Redirect based on wallet type
        let walletUrl: string;
        if (walletType === 'baseapp') {
          walletUrl = 'https://base.org/wallet';
        } else if (walletType === 'coinbase') {
          walletUrl = 'https://www.coinbase.com/wallet';
        } else {
          walletUrl = 'https://metamask.io/download/';
        }
        
        setWalletState(prev => ({
          ...prev,
          isConnecting: false,
          error: `Please install ${walletType === 'baseapp' ? 'Base App' : walletType === 'metamask' ? 'MetaMask' : 'Coinbase Wallet'} first`,
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
      const isSmartWallet = !!(window.ethereum.isSmartWallet || window.ethereum.isPasskeyWallet);
      
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
        isSmartWallet,
        isBaseApp: walletType === 'baseapp' || detectBaseApp(),
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
      isSmartWallet: false,
      isBaseApp: detectBaseApp(),
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
