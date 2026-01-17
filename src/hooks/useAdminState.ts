import { useCallback, useEffect, useRef, useState } from "react";
import { useContractReads, resetContractVerification, type BonusLevelInfo, type ContractConfig } from "./useContractReads";
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
const INIT_TIMEOUT_MS = 15000; // Increased from 5s to 15s for slow RPC
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_CACHE_KEY = "memorymint_admin_cache_v1";

// Session memory cache (fast path)
let memoryCache: CachedAdminData | null = null;

function cacheKey(address: string, chainId: string) {
  return `${address.toLowerCase()}:${chainId.toLowerCase()}`;
}

function readSessionCache(): CachedAdminData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedAdminData;
  } catch {
    return null;
  }
}

function writeSessionCache(data: CachedAdminData): void {
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function getCachedData(address: string, chainId: string): CachedAdminData | null {
  const key = cacheKey(address, chainId);

  if (memoryCache && cacheKey(memoryCache.address, memoryCache.chainId) === key) {
    if (Date.now() - memoryCache.timestamp < CACHE_TTL_MS) return memoryCache;
  }

  const sessionData = readSessionCache();
  if (sessionData && cacheKey(sessionData.address, sessionData.chainId) === key) {
    if (Date.now() - sessionData.timestamp < CACHE_TTL_MS) {
      // promote to memory cache for faster subsequent reads
      memoryCache = sessionData;
      return sessionData;
    }
  }

  return null;
}

function setCachedData(data: CachedAdminData): void {
  memoryCache = data;
  writeSessionCache(data);
}

function clearCache(): void {
  memoryCache = null;
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // ignore
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });

  return (Promise.race([promise, timeoutPromise]) as Promise<T>).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
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
    error: contractError,
    isOwner,
  } = useContractReads();

  const [initState, setInitState] = useState<AdminInitState>("idle");
  const [authPhase, setAuthPhase] = useState<AdminAuthPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
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

  // TEMP (isolation): after a config-fetch failure, allow ONE retry run to bypass on-chain config reads.
  // This helps confirm whether the contract call is the blocker vs. logic/state.
  const mockConfigNextRunRef = useRef(false);
  const mockConfigUsedRef = useRef(false);

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
  // Also checks against contract owner if config is available
  const checkIsAdmin = useCallback((address: string, contractOwner?: string): boolean => {
    if (!address) return false;
    const isHardcodedAdmin = address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
    const isContractOwner = contractOwner ? address.toLowerCase() === contractOwner.toLowerCase() : false;
    return isHardcodedAdmin || isContractOwner;
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
    setAdminLoading(false);
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

  // ============ INITIALIZE ADMIN PANEL (SINGLE CONTROLLED FLOW) ============
  const initialize = useCallback(async () => {
    const runId = markNewRun();
    const start = performance.now();
    const stepTimings: Record<string, number> = {};

    let didSetTerminalState = false;
    let step: "wallet" | "network" | "admin role" | "config fetch" = "wallet";

    // Fail-detail fields (filled as we go)
    let chainId: string | null = null;
    let networkResult: boolean | null = null;
    let adminResult: boolean | null = null;
    let configResult: unknown = null;

    const finishTerminal = (state: AdminInitState, err: string | null) => {
      didSetTerminalState = true;
      setInitState(state);
      setError(err);
    };

    // Always enter a known loading state and ALWAYS exit it in finally.
    setAdminLoading(true);
    setInitState("initializing");
    setAuthPhase("verifying");
    setError(null);

    try {
      // 1) Wallet check (fail fast)
      step = "wallet";
      if (!walletAddress) {
        setHealthStatus((prev) => ({ ...prev, walletConnected: false, lastCheck: Date.now() }));
        finishTerminal("error", "Wallet not connected. Connect wallet to access admin.");
        return;
      }

      // Read chainId with a short timeout (prevents hanging provider requests)
      const chainIdStart = performance.now();
      chainId = await withTimeout(getCurrentChainId(), 2000, "Unable to read network. Retry.");
      stepTimings.chainId = performance.now() - chainIdStart;

      lastInitRef.current = { address: walletAddress, chainId };

      // 2) Cache fast-path
      if (chainId) {
        const cached = getCachedData(walletAddress, chainId);
        if (cached && cached.isAdmin && cached.config) {
          stepTimings.cached = performance.now() - start;
          setTimings(stepTimings);

          setHealthStatus({
            walletConnected: true,
            networkCorrect: true,
            isAdmin: true,
            contractReachable: true,
            configLoaded: true,
            abiFunctionsPresent: true,
            lastCheck: cached.timestamp,
          });

          setAuthPhase(null);
          finishTerminal("ready", null);
          return;
        }
      }

      // 3) Network check (fail fast)
      step = "network";
      const networkStart = performance.now();
      networkResult = !!chainId && chainId.toLowerCase() === BASE_CHAIN_ID.toLowerCase();
      stepTimings.network = performance.now() - networkStart;

      if (!networkResult) {
        setHealthStatus({
          walletConnected: true,
          networkCorrect: false,
          isAdmin: false,
          contractReachable: false,
          configLoaded: false,
          abiFunctionsPresent: true,
          lastCheck: Date.now(),
        });
        finishTerminal("error", "Wrong network. Please connect to Base.");
        return;
      }

      // 4) Config + bonus levels fetch FIRST (to check contract owner)
      // Then verify admin role (combining hardcoded admin + contract owner)
      step = "config fetch";
      const cfgStart = performance.now();

      const shouldUseMockConfig = mockConfigNextRunRef.current && !mockConfigUsedRef.current;
      let usedMockConfig = false;

      let cfg: ContractConfig | null = null;
      let levels: BonusLevelInfo[] = [];

      if (shouldUseMockConfig) {
        usedMockConfig = true;
        mockConfigNextRunRef.current = false;
        mockConfigUsedRef.current = true;

        cfg = ({ isLoaded: true } as unknown) as ContractConfig;
        levels = [];
        configResult = cfg;

        stepTimings.config = performance.now() - cfgStart;
        console.warn("[AdminInit] TEMP: using mock config for isolation test (one time)");
      } else {
        try {
          const [cfgRes, levelRes] = await withTimeout(
            Promise.all([
              fetchContractConfig(true),
              fetchBonusLevels(walletAddress).catch(() => [] as BonusLevelInfo[]),
            ]),
            INIT_TIMEOUT_MS,
            "Admin init timed out while fetching contract data"
          );

          cfg = cfgRes;
          levels = levelRes;
          configResult = cfg;

          stepTimings.config = performance.now() - cfgStart;
        } catch (e) {
          stepTimings.config = performance.now() - cfgStart;
          configResult = { error: e instanceof Error ? e.message : String(e) };
          throw e;
        }
      }

      if (!cfg) {
        console.error("[AdminInit][FAIL DETAIL]", {
          walletAddress,
          chainId,
          networkResult,
          adminResult,
          configResult,
        });
        throw new Error("Contract config missing (fetchContractConfig returned null)");
      }

      // 5) Admin role check AFTER config fetch (can check both hardcoded + contract owner)
      step = "admin role";
      const adminStart = performance.now();
      // Check against both hardcoded admin AND the contract owner from config
      adminResult = checkIsAdmin(walletAddress, cfg?.owner);
      stepTimings.admin = performance.now() - adminStart;

      if (!adminResult) {
        setHealthStatus({
          walletConnected: true,
          networkCorrect: true,
          isAdmin: false,
          contractReachable: true,
          configLoaded: true,
          abiFunctionsPresent: true,
          lastCheck: Date.now(),
        });
        finishTerminal("error", `Not authorized – wallet ${walletAddress.slice(0, 8)}... is not the contract owner (${cfg?.owner?.slice(0, 8) ?? 'unknown'}...)`);
        return;
      }
      if (!isActiveRun(runId)) return;

      const now = Date.now();
      stepTimings.total = performance.now() - start;
      setTimings(stepTimings);

      setHealthStatus({
        walletConnected: true,
        networkCorrect: true,
        isAdmin: true,
        contractReachable: true,
        configLoaded: true,
        abiFunctionsPresent: true,
        lastCheck: now,
      });

      // Do NOT persist mock config into cache
      if (chainId && !usedMockConfig) {
        setCachedData({
          address: walletAddress,
          chainId,
          isAdmin: true,
          config: cfg,
          bonusLevels: levels,
          timestamp: now,
        });
      }

      console.info("[AdminInit] Ready", {
        runId,
        totalMs: Math.round(stepTimings.total ?? 0),
        timings: stepTimings,
      });

      setAuthPhase(null);
      finishTerminal("ready", null);
    } catch (err) {
      if (!isActiveRun(runId)) return;

      const message = err instanceof Error ? err.message : "Admin panel failed to load. Retry";

      console.error("[AdminInit][FAIL DETAIL]", {
        walletAddress,
        chainId,
        networkResult,
        adminResult,
        configResult,
      });

      console.error("[AdminInit] Failed", { step, message, err });

      // TEMP (isolation): if config fetch failed, allow the next retry to bypass config reads once.
      if (step === "config fetch" && !mockConfigUsedRef.current) {
        mockConfigNextRunRef.current = true;
      }

      stepTimings.total = performance.now() - start;
      setTimings(stepTimings);

      finishTerminal("error", message);
    } finally {
      if (!isActiveRun(runId)) return;

      // Guarantee: loader must always resolve into ready or error.
      if (!didSetTerminalState) {
        console.error("[AdminInit] Loader exited without terminal state; forcing error");
        finishTerminal("error", "Admin data failed to load. Retry");
      }

      setAuthPhase(null);
      setAdminLoading(false);
    }
  }, [
    walletAddress,
    markNewRun,
    isActiveRun,
    checkIsAdmin,
    fetchContractConfig,
    fetchBonusLevels,
    getCurrentChainId,
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
      // Wallet address prop is expected to change; initialization will run from effect.
    };

    const handleChainChanged = () => {
      console.log("[AdminState] Chain changed, clearing cache");
      clearCache();
      invalidateConfigCache();
      invalidateWalletCache();
      resetContractVerification(); // Reset preflight check for new network
      resetState();
      // Chain can change without walletAddress prop changing; force re-init.
      queueMicrotask(() => {
        initialize();
      });
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
  }, [invalidateConfigCache, invalidateWalletCache, resetState, initialize]);

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
    initialize();
  }, [invalidateConfigCache, invalidateWalletCache, resetState, initialize]);

  const isReady = initState === "ready";

  return {
    // State
    initState,
    authPhase,
    healthStatus,
    config,
    bonusLevels,
    isLoading: adminLoading,
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
