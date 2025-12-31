import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useContractReads, type BonusLevelInfo, type ContractConfig } from "./useContractReads";
import { BASE_CHAIN_ID } from "@/contracts/MemoryMintContract";

// ============ TYPES ============
export type AdminInitState =
  | "idle"
  | "loadingAuth"
  | "loadingContract"
  | "loadingAdminData"
  | "ready"
  | "error";

export type AdminAuthPhase = "connectingWallet" | "verifyingNetwork" | "verifyingAdmin";

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
  authPhase: AdminAuthPhase | null;
  healthStatus: AdminHealthStatus;
  config: ContractConfig | null;
  bonusLevels: BonusLevelInfo[];
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
}

const ADMIN_ADDRESS = "0x830f4c15480aa516a0cc4826902443936f9596cf";
const STEP_TIMEOUT_MS = 8000;

function shortAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function isTimeoutError(err: unknown) {
  return err instanceof Error && err.name === "TimeoutError";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      const e = new Error(`${label} timed out`);
      e.name = "TimeoutError";
      reject(e);
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
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
  const [authPhase, setAuthPhase] = useState<AdminAuthPhase | null>("connectingWallet");
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

  // Prevent stale async updates after wallet/network changes
  const runIdRef = useRef(0);
  const markNewRun = useCallback(() => {
    runIdRef.current += 1;
    return runIdRef.current;
  }, []);
  const isActiveRun = useCallback((runId: number) => runIdRef.current === runId, []);

  // ============ CHECK NETWORK ============
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

  const resetState = useCallback(() => {
    markNewRun();
    setError(null);
    setInitState("idle");
    setAuthPhase("connectingWallet");
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

  // ============ INITIALIZE ADMIN PANEL ============
  const initialize = useCallback(async () => {
    const runId = markNewRun();
    const startedAt = Date.now();

    setError(null);
    setInitState("loadingAuth");

    // NOTE: Do not log admin address; only log step results.
    console.log("[AdminInit] start", {
      runId,
      wallet: walletAddress ? shortAddr(walletAddress) : null,
    });

    // Step 2: Resolve wallet (non-blocking UI)
    setAuthPhase("connectingWallet");
    setHealthStatus((prev) => ({ ...prev, walletConnected: !!walletAddress }));

    if (!walletAddress) {
      console.log("[AdminInit] waiting for wallet", { runId });
      return;
    }

    try {
      // Step 3: Resolve network
      setAuthPhase("verifyingNetwork");
      const isCorrectNetwork = await withTimeout(checkNetwork(), STEP_TIMEOUT_MS, "network check");
      if (!isActiveRun(runId)) return;

      if (!isCorrectNetwork) {
        console.warn("[AdminInit] wrong network", { runId });
        setHealthStatus((prev) => ({
          ...prev,
          walletConnected: true,
          networkCorrect: false,
          lastCheck: startedAt,
        }));
        setError("Wrong network. Please connect to Base.");
        setInitState("error");
        return;
      }

      setHealthStatus((prev) => ({ ...prev, networkCorrect: true }));

      // Step 4: Verify admin
      setAuthPhase("verifyingAdmin");
      const userIsAdmin = checkIsAdmin(walletAddress);
      if (!userIsAdmin) {
        console.warn("[AdminInit] not authorized", { runId, wallet: shortAddr(walletAddress) });
        setHealthStatus((prev) => ({
          ...prev,
          walletConnected: true,
          networkCorrect: true,
          isAdmin: false,
          lastCheck: startedAt,
        }));
        setError("Not authorized – owner access required");
        setInitState("error");
        return;
      }

      setHealthStatus((prev) => ({ ...prev, isAdmin: true }));

      // Step 5: Initialize contract (config)
      setAuthPhase(null);
      setInitState("loadingContract");

      let configResult: ContractConfig | null = null;
      try {
        configResult = await withTimeout(fetchContractConfig(true), STEP_TIMEOUT_MS, "contract config");
      } catch (err) {
        if (!isActiveRun(runId)) return;
        console.warn("[AdminInit] contract config failed", {
          runId,
          reason: err instanceof Error ? err.message : "unknown",
        });
        configResult = null;
      }

      if (!isActiveRun(runId)) return;

      setHealthStatus((prev) => ({
        ...prev,
        contractReachable: !!configResult,
        configLoaded: !!configResult?.isLoaded,
      }));

      // Step 6: Fetch admin data (bonus levels)
      setInitState("loadingAdminData");
      try {
        await withTimeout(fetchBonusLevels(walletAddress), STEP_TIMEOUT_MS, "admin data");
      } catch (err) {
        if (!isActiveRun(runId)) return;
        console.warn("[AdminInit] admin data load failed", {
          runId,
          reason: err instanceof Error ? err.message : "unknown",
        });
        // Non-fatal: keep rendering a partial UI.
      }

      if (!isActiveRun(runId)) return;

      setHealthStatus((prev) => ({ ...prev, lastCheck: startedAt }));
      setInitState("ready");
      console.log("[AdminInit] ready", { runId, ms: Date.now() - startedAt });
    } catch (err) {
      if (!isActiveRun(runId)) return;

      if (isTimeoutError(err)) {
        console.error("[AdminInit] timeout", { runId, at: (err as Error).message });
        setError("Admin panel failed to load. Retry?");
      } else {
        console.error("[AdminInit] error", { runId, err });
        setError(err instanceof Error ? err.message : "Admin panel failed to load. Retry?");
      }

      setHealthStatus((prev) => ({ ...prev, lastCheck: startedAt }));
      setInitState("error");
    }
  }, [walletAddress, markNewRun, checkNetwork, isActiveRun, checkIsAdmin, fetchContractConfig, fetchBonusLevels]);

  // ============ AUTO-INITIALIZE (strict order, no blocking render) ============
  useEffect(() => {
    initialize();
  }, [initialize]);

  // ============ RESET ON WALLET/NETWORK CHANGES ============
  useEffect(() => {
    const handleAccountsChanged = () => {
      invalidateConfigCache();
      invalidateWalletCache();
      resetState();
    };

    const handleChainChanged = () => {
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

    try {
      status.networkCorrect = await withTimeout(checkNetwork(), STEP_TIMEOUT_MS, "network check");
    } catch {
      status.networkCorrect = false;
    }

    if (status.walletConnected && status.networkCorrect && status.isAdmin) {
      try {
        const cfg = await withTimeout(fetchContractConfig(true), STEP_TIMEOUT_MS, "contract config");
        status.contractReachable = !!cfg;
        status.configLoaded = !!cfg?.isLoaded;
      } catch {
        status.contractReachable = false;
        status.configLoaded = false;
      }
    }

    setHealthStatus(status);
    return status;
  }, [walletAddress, checkNetwork, checkIsAdmin, fetchContractConfig]);

  // ============ RETRY INITIALIZATION ============
  const retry = useCallback(() => {
    invalidateConfigCache();
    invalidateWalletCache();
    resetState();
  }, [invalidateConfigCache, invalidateWalletCache, resetState]);

  const isReady = initState === "ready";

  const isLoading = useMemo(() => {
    return contractLoading || ["loadingAuth", "loadingContract", "loadingAdminData"].includes(initState);
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
