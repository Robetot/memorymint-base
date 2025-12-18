import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Types for Base App context
export interface BaseAppUser {
  address: string;
  basename?: string;
  fid?: number;
}

export interface BaseAppContextType {
  // Environment detection
  isBaseApp: boolean;
  isReady: boolean;
  
  // User state
  user: BaseAppUser | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Wallet state
  walletAddress: string | null;
  chainId: number | null;
  isCorrectChain: boolean;
  
  // Actions
  connect: () => Promise<boolean>;
  disconnect: () => void;
  switchToBase: () => Promise<boolean>;
  
  // Deep linking
  openUrl: (url: string) => void;
  shareToBase: (text: string, url?: string) => Promise<void>;
}

const BASE_CHAIN_ID = 8453;

const BaseAppContext = createContext<BaseAppContextType | null>(null);

interface BaseAppProviderProps {
  children: ReactNode;
}

// Detect if running inside Base App (Coinbase Wallet beta)
function detectBaseApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for Coinbase Wallet provider indicators
  const ethereum = window.ethereum as any;
  
  // Base App uses Coinbase Wallet under the hood
  if (ethereum?.isCoinbaseWallet) {
    // Additional check for Base App specific features
    const userAgent = navigator.userAgent.toLowerCase();
    const isBaseAppUA = userAgent.includes('base') || userAgent.includes('coinbase');
    
    // Check if we're in an embedded webview with smart wallet
    const isSmartWallet = ethereum?.isSmartWallet || ethereum?.isPasskeyWallet;
    
    return isBaseAppUA || isSmartWallet || false;
  }
  
  // Check URL params for Base App deep link
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('baseapp') || urlParams.has('source') && urlParams.get('source') === 'baseapp') {
    return true;
  }
  
  return false;
}

export function BaseAppProvider({ children }: BaseAppProviderProps) {
  const [isBaseApp, setIsBaseApp] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<BaseAppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  // Initialize and detect Base App environment
  useEffect(() => {
    const init = async () => {
      try {
        const detected = detectBaseApp();
        setIsBaseApp(detected);
        
        if (detected && window.ethereum) {
          // Try to get connected accounts
          try {
            const accounts = await (window.ethereum as any).request({ 
              method: 'eth_accounts' 
            }) as string[];
            
            if (accounts && accounts.length > 0) {
              setWalletAddress(accounts[0]);
              setUser({ address: accounts[0] });
              
              // Get chain ID
              const chainIdHex = await (window.ethereum as any).request({ 
                method: 'eth_chainId' 
              }) as string;
              setChainId(parseInt(chainIdHex, 16));
            }
          } catch (err) {
            console.log('Base App: No accounts connected yet');
          }
        }
        
        setIsReady(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Base App init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize Base App');
        setIsReady(true);
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        setWalletAddress(null);
        setUser(null);
      } else {
        setWalletAddress(accs[0]);
        setUser({ address: accs[0] });
      }
    };

    const handleChainChanged = (chainIdHex: unknown) => {
      setChainId(parseInt(chainIdHex as string, 16));
    };

    (window.ethereum as any).on('accountsChanged', handleAccountsChanged);
    (window.ethereum as any).on('chainChanged', handleChainChanged);

    return () => {
      (window.ethereum as any)?.removeListener('accountsChanged', handleAccountsChanged);
      (window.ethereum as any)?.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  // Connect wallet
  const connect = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!window.ethereum) {
        // Open Base App download page
        window.open('https://base.org/wallet', '_blank');
        setError('Please install Base App to continue');
        setIsLoading(false);
        return false;
      }

      const accounts = await (window.ethereum as any).request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      setWalletAddress(address);
      setUser({ address });

      // Get chain ID
      const chainIdHex = await (window.ethereum as any).request({ 
        method: 'eth_chainId' 
      }) as string;
      const currentChainId = parseInt(chainIdHex, 16);
      setChainId(currentChainId);

      // Switch to Base if not on it
      if (currentChainId !== BASE_CHAIN_ID) {
        await switchToBase();
      }

      setIsLoading(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    setWalletAddress(null);
    setUser(null);
    setError(null);
  }, []);

  // Switch to Base network
  const switchToBase = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false;

    try {
      await (window.ethereum as any).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }],
      });
      setChainId(BASE_CHAIN_ID);
      return true;
    } catch (switchError: any) {
      // Chain not added, try to add it
      if (switchError?.code === 4902) {
        try {
          await (window.ethereum as any).request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
              chainName: 'Base',
              nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
          setChainId(BASE_CHAIN_ID);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }, []);

  // Open URL (for deep linking)
  const openUrl = useCallback((url: string) => {
    if (isBaseApp) {
      // In Base App, use native navigation if available
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  }, [isBaseApp]);

  // Share to Base App social feed
  const shareToBase = useCallback(async (text: string, url?: string) => {
    const shareUrl = url ? `${text} ${url}` : text;
    
    // Base App uses Farcaster for social features
    const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareUrl)}`;
    
    if (isBaseApp) {
      window.location.href = warpcastUrl;
    } else {
      window.open(warpcastUrl, '_blank');
    }
  }, [isBaseApp]);

  const value: BaseAppContextType = {
    isBaseApp,
    isReady,
    user,
    isConnected: !!walletAddress,
    isLoading,
    error,
    walletAddress,
    chainId,
    isCorrectChain: chainId === BASE_CHAIN_ID,
    connect,
    disconnect,
    switchToBase,
    openUrl,
    shareToBase,
  };

  return (
    <BaseAppContext.Provider value={value}>
      {children}
    </BaseAppContext.Provider>
  );
}

// Default fallback values
const defaultBaseAppContext: BaseAppContextType = {
  isBaseApp: false,
  isReady: true,
  user: null,
  isConnected: false,
  isLoading: false,
  error: null,
  walletAddress: null,
  chainId: null,
  isCorrectChain: false,
  connect: async () => false,
  disconnect: () => {},
  switchToBase: async () => false,
  openUrl: () => {},
  shareToBase: async () => {},
};

export function useBaseApp() {
  const context = useContext(BaseAppContext);
  return context ?? defaultBaseAppContext;
}
