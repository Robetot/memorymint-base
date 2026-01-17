import { useState, useCallback, useEffect, useRef } from 'react';
import EthereumProvider from '@walletconnect/ethereum-provider';

// Base Mainnet chain configuration
const BASE_CHAIN_ID = '0x2105'; // 8453 in hex
const BASE_CHAIN_ID_NUMERIC = 8453;
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

// WalletConnect Project ID - Get your own at https://cloud.walletconnect.com
// Using WalletConnect's public demo project ID for initial testing
const WALLETCONNECT_PROJECT_ID = '3a8170812b534d0ff9d794f19a901d64';

export type WalletType = 'metamask' | 'coinbase' | 'baseapp' | 'walletconnect';

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

const WALLET_STORAGE_KEY = 'memorymint_wallet';

// Load saved wallet state from localStorage
function loadSavedWallet(): { walletType: WalletType | null; address: string | null } {
  try {
    const saved = localStorage.getItem(WALLET_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return { walletType: null, address: null };
}

// Save wallet state to localStorage
function saveWalletState(walletType: WalletType | null, address: string | null) {
  try {
    if (walletType && address) {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ walletType, address }));
    } else {
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  } catch {}
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
  
  // WalletConnect provider instance
  const wcProviderRef = useRef<EthereumProvider | null>(null);

  // Detect Base App and restore connection on mount
  useEffect(() => {
    const isBaseApp = detectBaseApp();
    setWalletState(prev => ({ ...prev, isBaseApp }));
    
    // Auto-connect if in Base App or has saved connection
    const savedWallet = loadSavedWallet();
    if ((isBaseApp || savedWallet.address) && window.ethereum) {
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
      // Handle WalletConnect separately
      if (walletType === 'walletconnect') {
        return await connectWalletConnect();
      }

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

      const finalState = {
        isConnected: true,
        isConnecting: false,
        address,
        walletType,
        chainId: BASE_CHAIN_ID,
        isCorrectChain: true,
        error: null,
        isSmartWallet,
        isBaseApp: walletType === 'baseapp' || detectBaseApp(),
      };
      
      setWalletState(finalState);
      saveWalletState(walletType, address);

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

  // WalletConnect connection handler
  const connectWalletConnect = useCallback(async () => {
    try {
      // Initialize WalletConnect provider
      const provider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [BASE_CHAIN_ID_NUMERIC],
        showQrModal: true,
        optionalChains: [1, 8453], // Ethereum mainnet and Base
        metadata: {
          name: 'MemoryMint',
          description: 'Play memory games and mint NFTs on Base',
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.ico`],
        },
        qrModalOptions: {
          themeMode: 'dark' as const,
        },
      });

      wcProviderRef.current = provider;

      // Set up event listeners
      provider.on('display_uri', (uri: string) => {
        console.log('WalletConnect URI:', uri);
      });

      provider.on('session_delete', () => {
        disconnectWallet();
      });

      provider.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setWalletState(prev => ({ ...prev, address: accounts[0] }));
        }
      });

      provider.on('chainChanged', (chainIdRaw: string | number) => {
        const chainIdNum = typeof chainIdRaw === 'string' ? parseInt(chainIdRaw, 16) : chainIdRaw;
        const chainIdHex = `0x${chainIdNum.toString(16)}`;
        const isCorrect = chainIdHex.toLowerCase() === BASE_CHAIN_ID.toLowerCase();
        setWalletState(prev => ({ ...prev, chainId: chainIdHex, isCorrectChain: isCorrect }));
      });

      // Connect and get accounts
      const accounts = await provider.enable();

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      const chainId = provider.chainId;
      const chainIdHex = `0x${chainId.toString(16)}`;
      const isCorrectChain = chainId === BASE_CHAIN_ID_NUMERIC;

      // If not on Base, try to switch
      if (!isCorrectChain) {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID }],
          });
        } catch (switchError) {
          console.log('Could not auto-switch to Base via WalletConnect');
        }
      }

      const finalState: WalletState = {
        isConnected: true,
        isConnecting: false,
        address,
        walletType: 'walletconnect',
        chainId: chainIdHex,
        isCorrectChain,
        error: null,
        isSmartWallet: false,
        isBaseApp: false,
      };

      setWalletState(finalState);
      saveWalletState('walletconnect', address);

      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect via WalletConnect';
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    // Disconnect WalletConnect if active
    if (wcProviderRef.current) {
      try {
        await wcProviderRef.current.disconnect();
      } catch (err) {
        console.log('WalletConnect disconnect error:', err);
      }
      wcProviderRef.current = null;
    }
    
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
    saveWalletState(null, null);
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
