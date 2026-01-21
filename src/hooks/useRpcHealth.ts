// ============================================================
// React Hook for RPC Health Monitoring
// Provides real-time RPC status for UI components
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  initializeRpcProvider,
  runHealthCheck,
  getAllEndpointsHealth,
  getCurrentRpcUrl,
  getHealthyEndpointCount,
  forceEndpoint,
  BASE_RPC_ENDPOINTS,
} from '@/utils/rpcProvider';

export interface RPCEndpointHealth {
  url: string;
  healthy: boolean;
  latencyMs: number | null;
  lastChecked: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
}

export interface UseRpcHealthReturn {
  isInitialized: boolean;
  currentRpcUrl: string;
  healthyCount: number;
  totalCount: number;
  endpoints: RPCEndpointHealth[];
  isHealthy: boolean;
  refreshHealth: () => Promise<void>;
  forceEndpoint: (url: string) => boolean;
}

export function useRpcHealth(): UseRpcHealthReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [endpoints, setEndpoints] = useState<RPCEndpointHealth[]>([]);
  const [currentUrl, setCurrentUrl] = useState('');
  const [healthyCount, setHealthyCount] = useState(0);
  
  const updateState = useCallback(() => {
    setEndpoints(getAllEndpointsHealth());
    setCurrentUrl(getCurrentRpcUrl());
    setHealthyCount(getHealthyEndpointCount());
  }, []);
  
  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      await initializeRpcProvider();
      updateState();
      setIsInitialized(true);
    };
    
    init();
    
    // Update state periodically
    const interval = setInterval(updateState, 5000);
    return () => clearInterval(interval);
  }, [updateState]);
  
  const refreshHealth = useCallback(async () => {
    await runHealthCheck();
    updateState();
  }, [updateState]);
  
  const handleForceEndpoint = useCallback((url: string) => {
    const result = forceEndpoint(url);
    updateState();
    return result;
  }, [updateState]);
  
  return {
    isInitialized,
    currentRpcUrl: currentUrl,
    healthyCount,
    totalCount: BASE_RPC_ENDPOINTS.length,
    endpoints,
    isHealthy: healthyCount > 0,
    refreshHealth,
    forceEndpoint: handleForceEndpoint,
  };
}
