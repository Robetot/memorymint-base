import { useState, useCallback, useEffect, useRef } from 'react';
import { useContractReads, ContractConfig, BonusLevelInfo } from './useContractReads';
import { BASE_CHAIN_ID } from '@/contracts/MemoryMintContract';

// ============ TYPES ============
export type AdminInitState = 
  | 'idle'
  | 'checking-wallet'
  | 'checking-network'
  | 'checking-admin'
  | 'loading-config'
  | 'ready'
  | 'error';

export interface AdminHealthStatus {
  walletConnected: boolean;
  networkCorrect: boolean;
  isAdmin: boolean;
  contractReachable: boolean;
  configLoaded: boolean;
  abiFunctionsPresent: boolean;
  lastCheck: number;
}

export interface AdminState {
  initState: AdminInitState;
  healthStatus: AdminHealthStatus;
  config: ContractConfig | null;
  bonusLevels: BonusLevelInfo[];
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
}

// ============ HOOK ============
export function useAdminState(walletAddress: string) {
  const { 
    config, 
    fetchContractConfig, 
    fetchBonusLevels, 
    bonusLevels, 
    isOwner, 
    invalidateConfigCache,
    invalidateWalletCache,
    isLoading: contractLoading,
    error: contractError,
  } = useContractReads();

  const [initState, setInitState] = useState<AdminInitState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<AdminHealthStatus>({
    walletConnected: false,
    networkCorrect: false,
    isAdmin: false,
    contractReachable: false,
    configLoaded: false,
    abiFunctionsPresent: true, // Assumed true if ABI is defined
    lastCheck: 0,
  });
  
  const initRef = useRef(false);
  const previousWalletRef = useRef<string>('');
  const previousNetworkRef = useRef<string>('');

  // ============ CHECK NETWORK ============
  const checkNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false;
    try {
      const chainId = await (window.ethereum as any).request({ method: 'eth_chainId' });
      return chainId?.toLowerCase() === BASE_CHAIN_ID.toLowerCase();
    } catch {
      return false;
    }
  }, []);

  // ============ HARDCODED ADMIN ADDRESS ============
  // This is the SOLE gate for admin access - do NOT rely on contract.owner()
  const ADMIN_ADDRESS = '0x830f4c15480aa516a0cc4826902443936f9596cf';
  
  // ============ CHECK ADMIN (LOCAL, NO CONTRACT CALL) ============
  const checkIsAdmin = useCallback((address: string): boolean => {
    if (!address) return false;
    return address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  }, []);

  // ============ INITIALIZE ADMIN PANEL ============
  const initialize = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;
    
    setError(null);
    const startTime = Date.now();
    
    try {
      // Step 1: Check wallet connection
      setInitState('checking-wallet');
      if (!walletAddress) {
        setError('Wallet not connected');
        setInitState('error');
        setHealthStatus(prev => ({ ...prev, walletConnected: false, lastCheck: startTime }));
        return;
      }
      setHealthStatus(prev => ({ ...prev, walletConnected: true }));

      // Step 2: Check network BEFORE admin check
      setInitState('checking-network');
      const isCorrectNetwork = await checkNetwork();
      if (!isCorrectNetwork) {
        setError('Please connect to Base network');
        setInitState('error');
        setHealthStatus(prev => ({ ...prev, networkCorrect: false, lastCheck: startTime }));
        return;
      }
      setHealthStatus(prev => ({ ...prev, networkCorrect: true }));

      // Step 3: Check admin status (LOCAL, NO CONTRACT CALL)
      // This must happen AFTER wallet and network are confirmed
      setInitState('checking-admin');
      const userIsAdmin = checkIsAdmin(walletAddress);
      if (!userIsAdmin) {
        setError('Not authorized - owner access required');
        setInitState('error');
        setHealthStatus(prev => ({ ...prev, isAdmin: false, lastCheck: startTime }));
        return;
      }
      setHealthStatus(prev => ({ ...prev, isAdmin: true }));

      // Step 4: Load contract config (now that we know user is admin)
      setInitState('loading-config');
      const configResult = await fetchContractConfig(true);
      
      if (!configResult) {
        // Config load failed but user IS admin - show warning but allow access
        console.warn('[AdminState] Config load failed, allowing admin access with limited data');
        setHealthStatus(prev => ({ 
          ...prev, 
          contractReachable: false, 
          configLoaded: false,
          lastCheck: startTime,
        }));
        // Still proceed to ready state - admin access is based on address, not contract
        setInitState('ready');
        return;
      }
      
      setHealthStatus(prev => ({ 
        ...prev, 
        contractReachable: true, 
        configLoaded: true,
      }));

      // Step 5: Load bonus levels
      await fetchBonusLevels(walletAddress);

      // All checks passed
      setHealthStatus(prev => ({ ...prev, lastCheck: startTime }));
      setInitState('ready');
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Initialization failed';
      setError(msg);
      setInitState('error');
      setHealthStatus(prev => ({ ...prev, lastCheck: startTime }));
    } finally {
      initRef.current = false;
    }
  }, [walletAddress, checkNetwork, fetchContractConfig, fetchBonusLevels, checkIsAdmin]);

  // ============ REFRESH CONFIG ============
  const refreshConfig = useCallback(async () => {
    invalidateConfigCache();
    const configResult = await fetchContractConfig(true);
    if (configResult && walletAddress) {
      await fetchBonusLevels(walletAddress);
    }
    return configResult;
  }, [invalidateConfigCache, fetchContractConfig, fetchBonusLevels, walletAddress]);

  // ============ HANDLE WALLET/NETWORK CHANGE ============
  useEffect(() => {
    const handleAccountsChanged = () => {
      // Clear caches and reinitialize
      invalidateConfigCache();
      invalidateWalletCache();
      initRef.current = false;
      setInitState('idle');
    };

    const handleChainChanged = () => {
      // Clear caches and reinitialize
      invalidateConfigCache();
      invalidateWalletCache();
      initRef.current = false;
      setInitState('idle');
    };

    if (window.ethereum) {
      (window.ethereum as any).on('accountsChanged', handleAccountsChanged);
      (window.ethereum as any).on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        (window.ethereum as any).removeListener('accountsChanged', handleAccountsChanged);
        (window.ethereum as any).removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [invalidateConfigCache, invalidateWalletCache]);

  // ============ DETECT WALLET ADDRESS CHANGE ============
  useEffect(() => {
    if (walletAddress !== previousWalletRef.current) {
      previousWalletRef.current = walletAddress;
      initRef.current = false;
      setInitState('idle');
    }
  }, [walletAddress]);

  // ============ AUTO-INITIALIZE ============
  useEffect(() => {
    if (initState === 'idle' && walletAddress) {
      initialize();
    }
  }, [initState, walletAddress, initialize]);

  // ============ RUN HEALTH CHECK ============
  const runHealthCheck = useCallback(async (): Promise<AdminHealthStatus> => {
    const status: AdminHealthStatus = {
      walletConnected: !!walletAddress,
      networkCorrect: await checkNetwork(),
      isAdmin: checkIsAdmin(walletAddress), // Use local check, not contract
      contractReachable: false,
      configLoaded: false,
      abiFunctionsPresent: true,
      lastCheck: Date.now(),
    };

    if (status.walletConnected && status.networkCorrect) {
      try {
        const configResult = await fetchContractConfig(true);
        status.contractReachable = !!configResult;
        status.configLoaded = !!configResult?.isLoaded;
      } catch {
        status.contractReachable = false;
      }
    }

    setHealthStatus(status);
    return status;
  }, [walletAddress, checkNetwork, fetchContractConfig, checkIsAdmin]);

  // ============ RETRY INITIALIZATION ============
  const retry = useCallback(() => {
    setError(null);
    initRef.current = false;
    setInitState('idle');
  }, []);

  return {
    // State
    initState,
    healthStatus,
    config,
    bonusLevels,
    isLoading: contractLoading || ['checking-wallet', 'checking-network', 'checking-admin', 'loading-config'].includes(initState),
    error: error || contractError,
    isReady: initState === 'ready',
    
    // Actions
    initialize,
    refreshConfig,
    runHealthCheck,
    retry,
    invalidateConfigCache,
    
    // Utilities
    isOwner,
  };
}
