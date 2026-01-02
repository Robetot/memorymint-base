import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useContractReads, type BonusLevelInfo, type ContractConfig } from "./useContractReads";
import { BASE_CHAIN_ID } from "@/contracts/MemoryMintContract";

// ============ TYPES ============
export type AdminInitState =
  | "idle"
  | "initializing"
  | "ready"
  | "error";

export type AdminAuthPhase = "connecting" | "verifying" | null;

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
  authPhase: AdminAuthPhase;
  healthStatus: AdminHealthStatus;
  config: ContractConfig | null;
  bonusLevels: BonusLevelInfo[];
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
}

interface CachedAdminData {
  address: string;
  chainId: string;
  isAdmin: boolean;
  config: ContractConfig | null;
  bonusLevels: BonusLevelInfo[];
  timestamp: number;
}

const ADMIN_ADDRESS = "0x830f4c15480aa516a0cc4826902443936f9596cf";
const INIT_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 60000; // 1 minute cache

// Session memory cache (faster than sessionStorage)
let memoryCache: CachedAdminData | null = null;

function getCachedData(address: string, chainId: string): CachedAdminData | null {
  if (
    memoryCache &&
    memoryCache.address.toLowerCase() === address.toLowerCase() &&
    memoryCache.chainId === chainId &&
    Date.now() - memoryCache.timestamp < CACHE_TTL_MS
  ) {
    return memoryCache;
  }
  return null;
}

function setCachedData(data: CachedAdminData): void {
  memoryCache = data;
}

function clearCache(): void {
  memoryCache = null;
}

function shortAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ============ HOOK ============
export function useAdminState(walletAddress: string) {
  const {
    config,
    fetchContractConfig,
    fetchBonusLevels,
    bonusLevels,
    invalidateConfigCache,
    invalidateWalletCache,
    isLoading: contractLoading,
    error: contractError,
    isOwner,
  } = useContractReads();

  const [initState, setInitState] = useState<AdminInitState>("idle");
  const [authPhase, setAuthPhase] = useState<AdminAuthPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<AdminHealthStatus>({
    walletConnected: false,
    networkCorrect: false,
    isAdmin: false,
    contractReachable: false,
    configLoaded: false,
    abiFunctionsPresent: true,
    lastCheck: 0,
  });
  const [timings, setTimings] = useState<Record<string, number>>({});

  // Prevent stale async updates and duplicate runs
  const runIdRef = useRef(0);
  const lastInitRef = useRef<{ address: string; chainId: string | null }>({ address: "", chainId: null });

  const markNewRun = useCallback(() => {
    runIdRef.current += 1;
    return runIdRef.current;
  }, []);

  const isActiveRun = useCallback((runId: number) => runIdRef.current === runId, []);

  // ============ CHECK NETWORK (instant) ============
  const checkNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false;
    const chainId = await (window.ethereum as any).request({ method: "eth_chainId" });
    return chainId?.toLowerCase() === BASE_CHAIN_ID.toLowerCase();
  }, []);

  // ============ CHECK ADMIN (LOCAL, NO CONTRACT CALL) ============
  const checkIsAdmin = useCallback((address: string): boolean => {
    if (!address) return false;
    return address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  }, []);

  // ============ GET CURRENT CHAIN ID ============
  const getCurrentChainId = useCallback(async (): Promise<string | null> => {
    if (!window.ethereum) return null;
    try {
      return await (window.ethereum as any).request({ method: "eth_chainId" });
    } catch {
      return null;
    }
  }, []);

  const resetState = useCallback(() => {
    markNewRun();
    setError(null);
    setInitState("idle");
    setAuthPhase(null);
    setHealthStatus({
      walletConnected: false,
      networkCorrect: false,
      isAdmin: false,
      contractReachable: false,
      configLoaded: false,
      abiFunctionsPresent: true,
      lastCheck: 0,
    });
  }, [markNewRun]);

  // ============ INITIALIZE ADMIN PANEL (PARALLEL, NON-BLOCKING) ============
  const initialize = useCallback(async () => {
    const startTime = performance.now();
    const runId = markNewRun();
    const stepTimings: Record<string, number> = {};

    // Get current chain ID first
    const currentChainId = await getCurrentChainId();

    // Skip if already initialized for same wallet/network
    if (
      lastInitRef.current.address === walletAddress &&
      lastInitRef.current.chainId === currentChainId &&
      initState === "ready"
    ) {
      console.log("[AdminInit] Already initialized, skipping");
      return;
    }

    lastInitRef.current = { address: walletAddress, chainId: currentChainId };

    setError(null);

    // Check for no wallet
    if (!walletAddress) {
      console.log("[AdminInit] No wallet connected");
      setInitState("idle");
      setHealthStatus((prev) => ({ ...prev, walletConnected: false }));
      return;
    }

    // Check cache for instant load
    const cached = currentChainId ? getCachedData(walletAddress, currentChainId) : null;
    if (cached && cached.isAdmin && cached.config) {
      console.log("[AdminInit] Using cached data (instant load)");
      setHealthStatus({
        walletConnected: true,
        networkCorrect: true,
        isAdmin: true,
        contractReachable: true,
        configLoaded: true,
        abiFunctionsPresent: true,
        lastCheck: cached.timestamp,
      });
      setInitState("ready");
      stepTimings.cached = performance.now() - startTime;
      setTimings(stepTimings);
      return;
    }

    // Start initialization - single loading state
    setInitState("initializing");
    setAuthPhase("verifying");
    setHealthStatus((prev) => ({ ...prev, walletConnected: true }));

    console.log("[AdminInit] Starting parallel initialization", {
      runId,
      wallet: shortAddr(walletAddress),
    });

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Admin panel timed out. Please retry."));
        }, INIT_TIMEOUT_MS);
      });

      // Run ALL checks in parallel
      const parallelChecks = async () => {
        const networkStart = performance.now();
        const configStart = performance.now();

        // Parallel execution of all checks
        const [networkResult, adminResult, configResult, bonusResult] = await Promise.all([
          // Network check
          checkNetwork().then((isCorrect) => {
            stepTimings.network = performance.now() - networkStart;
            return isCorrect;
          }),
          
          // Admin check (instant, local)
          Promise.resolve(checkIsAdmin(walletAddress)),
          
          // Config fetch
          fetchContractConfig(true).then((cfg) => {
            stepTimings.config = performance.now() - configStart;
            return cfg;
          }).catch((err) => {
            console.warn("[AdminInit] Config fetch failed:", err);
            stepTimings.config = performance.now() - configStart;
            return null;
          }),
          
          // Bonus levels fetch
          fetchBonusLevels(walletAddress).catch((err) => {
            console.warn("[AdminInit] Bonus levels fetch failed:", err);
            return [];
          }),
        ]);

        return { networkResult, adminResult, configResult, bonusResult };
      };

      // Race against timeout
      const results = await Promise.race([parallelChecks(), timeoutPromise]);

      if (!isActiveRun(runId)) return;

      const { networkResult, adminResult, configResult } = results;

      stepTimings.total = performance.now() - startTime;
      setTimings(stepTimings);

      console.log("[AdminInit] Parallel checks complete", {
        runId,
        network: networkResult,
        admin: adminResult,
        configLoaded: !!configResult,
        timings: stepTimings,
      });

      // Update health status with all results at once
      const now = Date.now();
      setHealthStatus({
        walletConnected: true,
        networkCorrect: networkResult,
        isAdmin: adminResult,
        contractReachable: !!configResult,
        configLoaded: !!configResult?.isLoaded,
        abiFunctionsPresent: true,
        lastCheck: now,
      });

      // Check for failures
      if (!networkResult) {
        setError("Wrong network. Please connect to Base.");
        setInitState("error");
        return;
      }

      if (!adminResult) {
        setError("Not authorized – owner access required");
        setInitState("error");
        return;
      }

      // Cache successful result
      if (currentChainId && configResult) {
        setCachedData({
          address: walletAddress,
          chainId: currentChainId,
          isAdmin: adminResult,
          config: configResult,
          bonusLevels: bonusLevels || [],
          timestamp: now,
        });
      }

      // Success!
      setAuthPhase(null);
      setInitState("ready");
      console.log("[AdminInit] Ready", {
        runId,
        totalMs: stepTimings.total?.toFixed(0),
      });

    } catch (err) {
      if (!isActiveRun(runId)) return;

      console.error("[AdminInit] Error:", err);
      setError(err instanceof Error ? err.message : "Admin panel failed to load. Retry?");
      setInitState("error");
      stepTimings.total = performance.now() - startTime;
      setTimings(stepTimings);
    }
  }, [
    walletAddress,
    markNewRun,
    isActiveRun,
    checkNetwork,
    checkIsAdmin,
    fetchContractConfig,
    fetchBonusLevels,
    bonusLevels,
    getCurrentChainId,
    initState,
  ]);

  // ============ AUTO-INITIALIZE ============
  useEffect(() => {
    initialize();
  }, [initialize]);

  // ============ RESET ON WALLET/NETWORK CHANGES ============
  useEffect(() => {
    const handleAccountsChanged = () => {
      console.log("[AdminState] Account changed, clearing cache");
      clearCache();
      invalidateConfigCache();
      invalidateWalletCache();
      resetState();
    };

    const handleChainChanged = () => {
      console.log("[AdminState] Chain changed, clearing cache");
      clearCache();
      invalidateConfigCache();
      invalidateWalletCache();
      resetState();
    };

    if (window.ethereum) {
      (window.ethereum as any).on("accountsChanged", handleAccountsChanged);
      (window.ethereum as any).on("chainChanged", handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        (window.ethereum as any).removeListener("accountsChanged", handleAccountsChanged);
        (window.ethereum as any).removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [invalidateConfigCache, invalidateWalletCache, resetState]);

  // ============ REFRESH CONFIG ============
  const refreshConfig = useCallback(async () => {
    clearCache();
    invalidateConfigCache();
    try {
      return await fetchContractConfig(true);
    } finally {
      if (walletAddress) {
        await fetchBonusLevels(walletAddress).catch(() => undefined);
      }
    }
  }, [invalidateConfigCache, fetchContractConfig, fetchBonusLevels, walletAddress]);

  // ============ RUN HEALTH CHECK ============
  const runHealthCheck = useCallback(async (): Promise<AdminHealthStatus> => {
    const now = Date.now();

    const status: AdminHealthStatus = {
      walletConnected: !!walletAddress,
      networkCorrect: false,
      isAdmin: checkIsAdmin(walletAddress),
      contractReachable: false,
      configLoaded: false,
      abiFunctionsPresent: true,
      lastCheck: now,
    };

    if (!walletAddress) {
      setHealthStatus(status);
      return status;
    }

    // Run checks in parallel
    const [networkOk, configResult] = await Promise.all([
      checkNetwork().catch(() => false),
      fetchContractConfig(true).catch(() => null),
    ]);

    status.networkCorrect = networkOk;
    status.contractReachable = !!configResult;
    status.configLoaded = !!configResult?.isLoaded;

    setHealthStatus(status);
    return status;
  }, [walletAddress, checkNetwork, checkIsAdmin, fetchContractConfig]);

  // ============ RETRY INITIALIZATION ============
  const retry = useCallback(() => {
    clearCache();
    invalidateConfigCache();
    invalidateWalletCache();
    lastInitRef.current = { address: "", chainId: null };
    resetState();
    // Will auto-reinitialize via useEffect
  }, [invalidateConfigCache, invalidateWalletCache, resetState]);

  const isReady = initState === "ready";

  const isLoading = useMemo(() => {
    return contractLoading || initState === "initializing";
  }, [contractLoading, initState]);

  return {
    // State
    initState,
    authPhase,
    healthStatus,
    config,
    bonusLevels,
    isLoading,
    error: error || contractError,
    isReady,
    timings,

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
