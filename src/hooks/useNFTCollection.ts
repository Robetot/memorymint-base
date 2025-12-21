import { useCallback, useEffect, useRef, useState } from "react";

// Must match the contract address in useNFTMint.ts
const NFT_CONTRACT_ADDRESS = "0xBf44A549C390923fD00B17E867804355E93Bf4c0";

// Base Mainnet chain ID
const BASE_CHAIN_ID = "0x2105"; // 8453

const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID,
  chainName: "Base",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"],
};

// ERC-721 Transfer event signature
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Multiple RPC endpoints for reliability - use public RPCs for reads
const RPC_ENDPOINTS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base.drpc.org",
  "https://1rpc.io/base",
];

// IPFS gateways with better reliability for Base App
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://w3s.link/ipfs/",
];

export interface NFTItem {
  tokenId: string;
  tokenURI: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  };
  isLoading?: boolean;
  hasError?: boolean;
}

type DebugPanel = {
  address: string;
  chainId: string | null;
  contract: string;
  balance: number | null;
  discoveredTokenIds: string[];
  tokenURIs: Record<string, string>;
  errors: string[];
  discoveryMethod?: 'events' | 'scan' | 'recent_mint' | 'none';
};

interface FetchState {
  nfts: NFTItem[];
  isLoading: boolean;
  error: string | null;
  chainError: string | null;
  balance: number | null;
  debug: DebugPanel | null;
}

async function fetchWithPublicRPC(method: string, params: unknown[]): Promise<unknown> {
  const errors: string[] = [];

  for (const rpc of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        errors.push(`${rpc}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.error) {
        errors.push(`${rpc}: ${data.error.message}`);
        continue;
      }

      return data.result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${rpc}: ${msg}`);
      continue;
    }
  }

  throw new Error(`All RPCs failed: ${errors.join("; ")}`);
}

function addressToTopic(address: string): string {
  return "0x" + address.toLowerCase().replace("0x", "").padStart(64, "0");
}

type RpcLog = {
  address?: string;
  topics: string[];
  data?: string;
  blockNumber: string;
  logIndex: string;
};

async function getBlockNumber(): Promise<number> {
  const hex = (await fetchWithPublicRPC("eth_blockNumber", [])) as string;
  return parseInt(hex, 16);
}

async function getTransferLogsSingle(filter: {
  fromBlock: string;
  toBlock: string;
  topics: (string | null)[];
}): Promise<RpcLog[]> {
  const logs = (await fetchWithPublicRPC("eth_getLogs", [
    {
      address: NFT_CONTRACT_ADDRESS,
      fromBlock: filter.fromBlock,
      toBlock: filter.toBlock,
      topics: filter.topics,
    },
  ])) as RpcLog[];

  return Array.isArray(logs) ? logs : [];
}

async function getTransferLogsWithFallback(topics: (string | null)[]): Promise<RpcLog[]> {
  // First try a single wide query (works fine when results are small, which they are per-wallet).
  try {
    return await getTransferLogsSingle({ fromBlock: "0x0", toBlock: "latest", topics });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If provider rejects wide ranges, fall back to chunking.
    if (!/range|too large|limit|exceed|timeout|response size/i.test(msg)) {
      throw err;
    }

    const latest = await getBlockNumber();
    const step = 500_000; // keeps requests bounded
    const out: RpcLog[] = [];

    for (let from = 0; from <= latest; from += step) {
      const to = Math.min(from + step - 1, latest);
      const fromBlock = `0x${from.toString(16)}`;
      const toBlock = `0x${to.toString(16)}`;

      const chunk = await getTransferLogsSingle({ fromBlock, toBlock, topics });
      out.push(...chunk);
    }

    return out;
  }
}

// Helper to resolve IPFS URLs with multiple gateway fallbacks
function resolveIPFSUrl(url: string): string {
  if (!url) return url;
  
  if (url.startsWith("ipfs://")) {
    const cid = url.replace("ipfs://", "");
    // Use Pinata as primary - most reliable
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  
  return url;
}

// Fetch with IPFS gateway fallback
async function fetchFromIPFS(ipfsUrl: string): Promise<Response> {
  if (!ipfsUrl.startsWith("ipfs://")) {
    return fetch(ipfsUrl, { signal: AbortSignal.timeout(15000) });
  }
  
  const cid = ipfsUrl.replace("ipfs://", "");
  
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}${cid}`, { 
        signal: AbortSignal.timeout(10000),
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) return response;
    } catch {
      // Try next gateway
    }
  }
  
  throw new Error(`All IPFS gateways failed for ${cid}`);
}

export function useNFTCollection(address: string | null) {
  const [state, setState] = useState<FetchState>({
    nfts: [],
    isLoading: false,
    error: null,
    chainError: null,
    balance: null,
    debug: null,
  });

  const fetchingRef = useRef(false);
  const attemptedSwitchRef = useRef(false);
  const recentMintTokenIdsRef = useRef<Set<string>>(new Set());
  const discoveryStartedAtRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  const ensureBaseNetwork = useCallback(async (): Promise<{ ok: boolean; chainId: string | null; error?: string }> => {
    // First verify we have a valid address
    if (!window.ethereum) {
      // In Base App context without window.ethereum, we trust the environment
      console.log("[NFT] No window.ethereum, assuming Base App environment on Base Mainnet");
      return { ok: true, chainId: BASE_CHAIN_ID };
    }

    try {
      const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      const chainIdNum = parseInt(chainId, 16);
      
      console.log(`[NFT] Current chain ID: ${chainIdNum} (expected: 8453)`);
      
      if (chainId?.toLowerCase() === BASE_CHAIN_ID.toLowerCase()) {
        return { ok: true, chainId };
      }

      // Auto-prompt a network switch (once) as required.
      if (!attemptedSwitchRef.current) {
        attemptedSwitchRef.current = true;
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BASE_CHAIN_ID }],
          });

          const newChainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
          return { ok: newChainId?.toLowerCase() === BASE_CHAIN_ID.toLowerCase(), chainId: newChainId };
        } catch (switchErr: any) {
          // Chain not added
          if (switchErr?.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [BASE_CHAIN_CONFIG],
              });
              const newChainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
              return { ok: newChainId?.toLowerCase() === BASE_CHAIN_ID.toLowerCase(), chainId: newChainId };
            } catch {
              return { ok: false, chainId, error: `Connected to chain ${chainIdNum}. Please switch to Base Mainnet (8453).` };
            }
          }

          return { ok: false, chainId, error: `Connected to chain ${chainIdNum}. Please switch to Base Mainnet (8453).` };
        }
      }

      return { ok: false, chainId, error: `Connected to chain ${chainIdNum}. Please switch to Base Mainnet (8453).` };
    } catch (err) {
      // Assume we're on Base if we can't check (Base App scenario)
      console.log("[NFT] Could not check chain, assuming Base App context");
      return { ok: true, chainId: BASE_CHAIN_ID };
    }
  }, []);

  const fetchBalance = useCallback(async (ownerAddress: string): Promise<number> => {
    // balanceOf(address) = 0x70a08231
    const paddedAddress = ownerAddress.toLowerCase().replace("0x", "").padStart(64, "0");
    const data = `0x70a08231${paddedAddress}`;

    const result = (await fetchWithPublicRPC("eth_call", [{ to: NFT_CONTRACT_ADDRESS, data }, "latest"])) as string;
    return parseInt(result, 16);
  }, []);

  const fetchOwnerOf = useCallback(async (tokenId: bigint): Promise<string | null> => {
    // ownerOf(uint256) = 0x6352211e
    const paddedTokenId = tokenId.toString(16).padStart(64, "0");
    const data = `0x6352211e${paddedTokenId}`;

    try {
      const result = (await fetchWithPublicRPC("eth_call", [{ to: NFT_CONTRACT_ADDRESS, data }, "latest"])) as string;
      if (!result || result.length < 66) return null;
      const addr = ("0x" + result.slice(-40)).toLowerCase();
      if (addr === ZERO_ADDRESS) return null;
      return addr;
    } catch {
      // If burned or invalid tokenId, many contracts revert.
      return null;
    }
  }, []);

  const fetchTokenURI = useCallback(async (tokenId: bigint): Promise<string | null> => {
    // tokenURI(uint256) = 0xc87b56dd
    const paddedTokenId = tokenId.toString(16).padStart(64, "0");
    const data = `0xc87b56dd${paddedTokenId}`;

    try {
      const result = (await fetchWithPublicRPC("eth_call", [{ to: NFT_CONTRACT_ADDRESS, data }, "latest"])) as string;
      if (result && result.length > 130) {
        // Decode ABI-encoded string
        const hex = result.slice(2);
        const length = parseInt(hex.slice(64, 128), 16);
        if (length > 0 && length < 10_000) {
          const stringHex = hex.slice(128, 128 + length * 2);
          const bytes: number[] = [];
          for (let i = 0; i < stringHex.length; i += 2) {
            bytes.push(parseInt(stringHex.substr(i, 2), 16));
          }
          return String.fromCharCode(...bytes);
        }
      }
    } catch {
      // ignore
    }

    return null;
  }, []);

  const fetchMetadata = useCallback(async (tokenURI: string): Promise<NFTItem["metadata"]> => {
    if (!tokenURI) return undefined;

    try {
      // data URI (base64 JSON)
      if (tokenURI.startsWith("data:application/json;base64,")) {
        const base64 = tokenURI.replace("data:application/json;base64,", "");
        const decoded = JSON.parse(atob(base64));
        // Resolve IPFS image URLs
        if (decoded.image) {
          decoded.image = resolveIPFSUrl(decoded.image);
        }
        return decoded;
      }

      // IPFS or HTTP
      const response = await fetchFromIPFS(tokenURI);
      if (response.ok) {
        const metadata = await response.json();
        // Resolve IPFS image URLs
        if (metadata.image) {
          metadata.image = resolveIPFSUrl(metadata.image);
        }
        return metadata;
      }
    } catch (err) {
      console.warn("[NFT] Failed to fetch metadata:", tokenURI, err);
    }

    return undefined;
  }, []);

  const fetchOwnedTokenIdsByEvents = useCallback(
    async (ownerAddress: string): Promise<string[]> => {
      const owner = ownerAddress.toLowerCase();
      const toTopic = addressToTopic(owner);

      // Try to discover tokenIds via Transfer logs.
      // Some RPCs/webviews are picky about `null` topic wildcards, so we fall back
      // to a mint-only query (from=0x0) with no null wildcards.
      let incoming: RpcLog[] = [];
      let firstErr: string | null = null;

      try {
        // Incoming transfers to this wallet then validate via ownerOf.
        incoming = await getTransferLogsWithFallback([TRANSFER_TOPIC, null, toTopic]);
      } catch (err) {
        firstErr = err instanceof Error ? err.message : String(err);
      }

      if (incoming.length === 0) {
        try {
          const zeroTopic = addressToTopic(ZERO_ADDRESS);
          incoming = await getTransferLogsWithFallback([TRANSFER_TOPIC, zeroTopic, toTopic]);
        } catch (err) {
          const secondErr = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Transfer log queries failed: ${[firstErr, secondErr].filter(Boolean).join(" | ")}`
          );
        }
      }

      const candidateIds = new Set<string>();
      for (const log of incoming) {
        if (!log.topics || log.topics.length < 4) continue;
        if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
        candidateIds.add(BigInt(log.topics[3]).toString());
      }

      const candidates = Array.from(candidateIds);
      const owned: string[] = [];
      for (const id of candidates) {
        const currentOwner = await fetchOwnerOf(BigInt(id));
        if (currentOwner && currentOwner === owner) owned.push(id);
      }

      // Sort newest-first for nicer UX (highest tokenId first)
      owned.sort((a, b) => Number(BigInt(b) - BigInt(a)));
      return owned;
    },
    [fetchOwnerOf]
  );

  // Fallback: scan recent token IDs to find owned ones (for when events aren't indexed yet)
  const scanRecentTokenIds = useCallback(
    async (ownerAddress: string, balance: number): Promise<string[]> => {
      const owner = ownerAddress.toLowerCase();
      const owned: string[] = [];
      
      // Try to get totalSupply to know where to start scanning
      try {
        const totalSupplyData = "0x18160ddd"; // totalSupply()
        const result = (await fetchWithPublicRPC("eth_call", [{ to: NFT_CONTRACT_ADDRESS, data: totalSupplyData }, "latest"])) as string;
        const totalSupply = parseInt(result, 16);
        
        if (totalSupply > 0) {
          // Scan from most recent token backwards
          const scanLimit = Math.min(100, totalSupply); // Don't scan more than 100 tokens
          
          for (let i = totalSupply; i > Math.max(0, totalSupply - scanLimit) && owned.length < balance; i--) {
            const currentOwner = await fetchOwnerOf(BigInt(i));
            if (currentOwner && currentOwner === owner) {
              owned.push(i.toString());
            }
          }
        }
      } catch (err) {
        console.warn("[NFT] totalSupply fallback failed:", err);
      }
      
      return owned;
    },
    [fetchOwnerOf]
  );

  const fetchCollection = useCallback(
    async (forceRefresh = false) => {
      if (!address) {
        console.log("[NFT] No address provided, skipping fetch");
        setState({ nfts: [], isLoading: false, error: null, chainError: null, balance: null, debug: null });
        return;
      }

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        console.error("[NFT] Invalid address format:", address);
        setState({ 
          nfts: [], 
          isLoading: false, 
          error: "Invalid wallet address format", 
          chainError: null, 
          balance: null, 
          debug: null 
        });
        return;
      }

      if (fetchingRef.current && !forceRefresh) return;
      fetchingRef.current = true;

      console.log(`[NFT] Fetching collection for address: ${address}`);

      // Clear cached NFT state on force refresh
      setState(prev => ({
        ...prev,
        nfts: forceRefresh ? [] : prev.nfts,
        isLoading: true,
        error: null,
        chainError: null,
      }));

      const debug: DebugPanel = {
        address,
        chainId: null,
        contract: NFT_CONTRACT_ADDRESS,
        balance: null,
        discoveredTokenIds: [],
        tokenURIs: {},
        errors: [],
        discoveryMethod: 'none',
      };

      try {
        const net = await ensureBaseNetwork();
        debug.chainId = net.chainId;

        if (!net.ok) {
          const chainError = net.error || "Wrong network. Please switch to Base Mainnet (Chain ID: 8453).";
          console.error("[NFT] Network check failed:", chainError);
          setState({
            nfts: [],
            isLoading: false,
            error: null,
            chainError,
            balance: null,
            debug,
          });
          fetchingRef.current = false;
          return;
        }

        console.log("[NFT] Network check passed, fetching balance...");

        // Direct on-chain validation (never show empty state if balance > 0)
        let balance: number;
        try {
          balance = await fetchBalance(address);
          console.log(`[NFT] Balance for ${address}: ${balance}`);
        } catch (balanceErr) {
          const msg = balanceErr instanceof Error ? balanceErr.message : String(balanceErr);
          console.error("[NFT] Failed to fetch balance:", msg);
          debug.errors.push(`Balance fetch failed: ${msg}`);
          setState({
            nfts: [],
            isLoading: false,
            error: "Failed to check NFT balance. Please try again.",
            chainError: null,
            balance: null,
            debug,
          });
          fetchingRef.current = false;
          return;
        }
        
        debug.balance = balance;

        if (balance === 0) {
          console.log("[NFT] No NFTs found for this address");
          setState({
            nfts: [],
            isLoading: false,
            error: null,
            chainError: null,
            balance,
            debug,
          });
          fetchingRef.current = false;
          return;
        }

        console.log(`[NFT] Found ${balance} NFT(s), discovering token IDs...`);

        let tokenIds: string[] = [];
        
        // First check if we have recent mint token IDs (most reliable immediately after mint)
        const recent = Array.from(recentMintTokenIdsRef.current);
        if (recent.length > 0) {
          console.log("[NFT] Using recent mint token IDs:", recent);
          tokenIds = [...recent];
          debug.discoveryMethod = 'recent_mint';
        }
        
        // Then try event-based discovery
        if (tokenIds.length < balance) {
          try {
            console.log("[NFT] Trying event-based discovery...");
            const eventTokenIds = await fetchOwnedTokenIdsByEvents(address);
            console.log("[NFT] Event discovery found:", eventTokenIds);
            tokenIds = Array.from(new Set([...tokenIds, ...eventTokenIds]));
            if (eventTokenIds.length > 0) {
              debug.discoveryMethod = 'events';
            }
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            console.warn("[NFT] Event discovery failed:", errMsg);
            debug.errors.push(`Event discovery: ${errMsg}`);
          }
        }
        
        debug.discoveredTokenIds = tokenIds;

        // If we have balance but no token IDs from events, try scanning
        if (tokenIds.length === 0 && balance > 0) {
          console.log("[NFT] Event discovery failed, trying token scan fallback...");
          try {
            tokenIds = await scanRecentTokenIds(address, balance);
            console.log("[NFT] Scan fallback found:", tokenIds);
            debug.discoveredTokenIds = tokenIds;
            if (tokenIds.length > 0) {
              debug.discoveryMethod = 'scan';
            }
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            console.warn("[NFT] Scan fallback failed:", errMsg);
            debug.errors.push(`Scan fallback: ${errMsg}`);
          }
        }

        // If still no token IDs but we have balance, show loading state and schedule retry
        if (tokenIds.length === 0 && balance > 0) {
          if (!discoveryStartedAtRef.current) discoveryStartedAtRef.current = Date.now();
          const elapsedMs = Date.now() - discoveryStartedAtRef.current;

          const shouldRetry = retryCountRef.current < 5 && elapsedMs < 60000; // Increased retry attempts

          console.log(`[NFT] No token IDs found yet. Retry ${retryCountRef.current + 1}/5, elapsed: ${elapsedMs}ms`);

          // Show placeholders but stop "Syncing" forever — after retries, show an actionable error.
          const placeholders: NFTItem[] = Array.from({ length: balance }).map((_, i) => ({
            tokenId: shouldRetry ? `loading-${i + 1}` : `error-${i + 1}`,
            tokenURI: "",
            isLoading: shouldRetry,
            hasError: !shouldRetry,
            metadata: shouldRetry
              ? {
                  name: `Syncing NFT ${i + 1} of ${balance}...`,
                  description: "Blockchain indexing in progress. Please wait...",
                }
              : {
                  name: `MemoryMint NFT ${i + 1}`,
                  description: "Token discovery timed out. Your NFT exists on-chain.",
                },
          }));

          const errorMsg = shouldRetry 
            ? null 
            : `Found ${balance} NFT(s) on-chain but couldn't retrieve token IDs. This may be a temporary RPC issue. Tap Refresh to retry.`;

          setState({
            nfts: placeholders,
            isLoading: false,
            error: errorMsg,
            chainError: null,
            balance,
            debug,
          });

          // Auto-retry after a short delay (up to 5 times)
          if (shouldRetry) {
            retryCountRef.current++;
            const delay = Math.min(2000 * (retryCountRef.current), 10000); // Exponential backoff
            console.log(`[NFT] Scheduling retry in ${delay}ms...`);
            setTimeout(() => {
              fetchingRef.current = false;
              fetchCollection(true);
            }, 3000);
          }

          fetchingRef.current = false;
          return;
        }

        discoveryStartedAtRef.current = null;
        retryCountRef.current = 0;

        // Fetch tokenURI + metadata; if anything fails we still keep the NFT card.
        const items: NFTItem[] = [];
        for (const id of tokenIds) {
          const tokenIdBig = BigInt(id);
          let tokenURI: string | null = null;
          
          // Try fetching tokenURI with retry
          for (let attempt = 0; attempt < 2; attempt++) {
            tokenURI = await fetchTokenURI(tokenIdBig);
            if (tokenURI) break;
            await new Promise(r => setTimeout(r, 500)); // Small delay before retry
          }
          
          if (tokenURI) debug.tokenURIs[id] = tokenURI;

          const item: NFTItem = {
            tokenId: id,
            tokenURI: tokenURI ?? "",
            isLoading: false,
            hasError: false,
          };

          if (tokenURI) {
            const md = await fetchMetadata(tokenURI);
            if (md) {
              item.metadata = md;
            } else {
              item.metadata = { name: `MemoryMint #${id}` };
              item.hasError = true;
            }
          } else {
            item.metadata = { name: `MemoryMint #${id}` };
            item.hasError = true;
          }

          items.push(item);
        }

        setState({
          nfts: items,
          isLoading: false,
          error: null,
          chainError: null,
          balance,
          debug,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch NFTs";
        debug.errors.push(msg);

        // Still honor the critical rule: if we *did* learn balance > 0, show placeholders.
        if (debug.balance && debug.balance > 0) {
          if (!discoveryStartedAtRef.current) discoveryStartedAtRef.current = Date.now();

          const placeholders: NFTItem[] = Array.from({ length: debug.balance }).map((_, i) => ({
            tokenId: `error-${i + 1}`,
            tokenURI: "",
            isLoading: false,
            hasError: true,
            metadata: {
              name: `MemoryMint NFT ${i + 1}`,
              description: "Tap Refresh to load metadata.",
            },
          }));

          setState({
            nfts: placeholders,
            isLoading: false,
            error: null,
            chainError: null,
            balance: debug.balance,
            debug,
          });
          fetchingRef.current = false;
          return;
        }

        setState(prev => ({ ...prev, isLoading: false, error: msg, debug }));
      } finally {
        fetchingRef.current = false;
      }
    },
    [address, ensureBaseNetwork, fetchBalance, fetchMetadata, fetchOwnedTokenIdsByEvents, fetchTokenURI, scanRecentTokenIds]
  );

  // Auto-fetch on mount and address change
  useEffect(() => {
    retryCountRef.current = 0;
    discoveryStartedAtRef.current = null;
    fetchCollection();
  }, [fetchCollection]);

  // Auto-refresh after mint (instant refresh fix)
  useEffect(() => {
    const handler = (evt: Event) => {
      const e = evt as CustomEvent<{ address?: string; tokenIds?: string[]; txHash?: string }>;
      const mintedTo = e.detail?.address?.toLowerCase();
      const mintedIds = (e.detail?.tokenIds ?? []).filter(Boolean);

      if (mintedTo && mintedTo === address?.toLowerCase()) {
        if (mintedIds.length > 0) {
          mintedIds.forEach((id) => recentMintTokenIdsRef.current.add(id));
        }

        console.log("[NFT] mint event received", { mintedTo, mintedIds, txHash: e.detail?.txHash });

        // Reset retry count and trigger refresh
        retryCountRef.current = 0;
        discoveryStartedAtRef.current = null;
        fetchCollection(true);
      }
    };

    window.addEventListener("memorymint:nft-minted", handler as EventListener);
    return () => window.removeEventListener("memorymint:nft-minted", handler as EventListener);
  }, [address, fetchCollection]);

  const refetch = useCallback(() => {
    attemptedSwitchRef.current = false; // allow switch prompt again on manual refresh
    recentMintTokenIdsRef.current.clear(); // clear stale recent mints on manual refresh
    discoveryStartedAtRef.current = null;
    retryCountRef.current = 0;
    return fetchCollection(true);
  }, [fetchCollection]);

  return {
    nfts: state.nfts,
    isLoading: state.isLoading,
    error: state.error,
    chainError: state.chainError,
    balance: state.balance,
    debug: state.debug,
    refetch,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
