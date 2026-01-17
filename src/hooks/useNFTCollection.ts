import { useCallback, useEffect, useRef, useState } from "react";

// Deployed MemoryMintUltraV3 contract on Base Mainnet
const NFT_CONTRACT_ADDRESS = "0xA26e44EA246a1BA59Fd417380204Bce6a6A3Dc7E";

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

// IPFS gateways with better reliability
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
  errorReason?: string;
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

async function fetchWithPublicRPC(method: string, params: unknown[], timeout = 15000): Promise<unknown> {
  const errors: string[] = [];

  for (const rpc of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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

// Chunk-based log fetching for better RPC compatibility
async function getTransferLogsChunked(
  topics: (string | null)[],
  fromBlock: number,
  toBlock: number,
  chunkSize = 100000
): Promise<RpcLog[]> {
  const results: RpcLog[] = [];
  
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, toBlock);
    try {
      const logs = await getTransferLogsSingle({
        fromBlock: `0x${start.toString(16)}`,
        toBlock: `0x${end.toString(16)}`,
        topics,
      });
      results.push(...logs);
    } catch (err) {
      console.warn(`[NFT] Log chunk ${start}-${end} failed:`, err);
      // Continue to next chunk instead of failing completely
    }
  }
  
  return results;
}

// Helper to resolve IPFS URLs with multiple gateway fallbacks
function resolveIPFSUrl(url: string, gatewayIndex = 0): string {
  if (!url) return url;
  
  if (url.startsWith("ipfs://")) {
    const cid = url.replace("ipfs://", "");
    const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
    return `${gateway}${cid}`;
  }
  
  // Already an HTTP URL pointing to IPFS - try to use a different gateway
  const ipfsMatch = url.match(/\/ipfs\/(.+)$/);
  if (ipfsMatch && gatewayIndex > 0) {
    const cid = ipfsMatch[1];
    const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
    return `${gateway}${cid}`;
  }
  
  return url;
}

// Fetch with IPFS gateway fallback and proper timeout
async function fetchFromIPFSWithRetry(url: string, maxRetries = 3): Promise<Response | null> {
  // Handle data URIs directly
  if (url.startsWith("data:")) {
    return new Response(url);
  }

  const isIPFS = url.startsWith("ipfs://") || url.includes("/ipfs/");
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const resolvedUrl = isIPFS ? resolveIPFSUrl(url, attempt) : url;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(resolvedUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json, */*' },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      console.warn(`[NFT] IPFS fetch attempt ${attempt + 1} failed: ${response.status} for ${resolvedUrl}`);
    } catch (err) {
      console.warn(`[NFT] IPFS fetch attempt ${attempt + 1} error for ${resolvedUrl}:`, err);
    }
  }
  
  return null;
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
  const retryCountRef = useRef(0);
  const maxRetries = 5;

  const ensureBaseNetwork = useCallback(async (): Promise<{ ok: boolean; chainId: string | null; error?: string }> => {
    if (!window.ethereum) {
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
      console.log("[NFT] Could not check chain, assuming Base App context");
      return { ok: true, chainId: BASE_CHAIN_ID };
    }
  }, []);

  const fetchBalance = useCallback(async (ownerAddress: string): Promise<number> => {
    const paddedAddress = ownerAddress.toLowerCase().replace("0x", "").padStart(64, "0");
    const data = `0x70a08231${paddedAddress}`;

    const result = (await fetchWithPublicRPC("eth_call", [{ to: NFT_CONTRACT_ADDRESS, data }, "latest"])) as string;
    return parseInt(result, 16);
  }, []);

  const fetchOwnerOf = useCallback(async (tokenId: bigint): Promise<string | null> => {
    const paddedTokenId = tokenId.toString(16).padStart(64, "0");
    const data = `0x6352211e${paddedTokenId}`;

    try {
      const result = (await fetchWithPublicRPC("eth_call", [{ to: NFT_CONTRACT_ADDRESS, data }, "latest"])) as string;
      if (!result || result.length < 66) return null;
      const addr = ("0x" + result.slice(-40)).toLowerCase();
      if (addr === ZERO_ADDRESS) return null;
      return addr;
    } catch {
      return null;
    }
  }, []);

  const fetchTokenURI = useCallback(async (tokenId: bigint): Promise<string | null> => {
    const paddedTokenId = tokenId.toString(16).padStart(64, "0");
    const data = `0xc87b56dd${paddedTokenId}`;

    try {
      const result = (await fetchWithPublicRPC("eth_call", [{ to: NFT_CONTRACT_ADDRESS, data }, "latest"])) as string;
      if (result && result.length > 130) {
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
    } catch (err) {
      console.warn(`[NFT] tokenURI fetch failed for token ${tokenId}:`, err);
    }

    return null;
  }, []);

  const fetchMetadata = useCallback(async (tokenURI: string): Promise<{ metadata: NFTItem["metadata"]; error?: string }> => {
    if (!tokenURI) return { metadata: undefined, error: "No tokenURI" };

    try {
      // Handle data URI (base64 JSON)
      if (tokenURI.startsWith("data:application/json;base64,")) {
        const base64 = tokenURI.replace("data:application/json;base64,", "");
        const decoded = JSON.parse(atob(base64));
        if (decoded.image) {
          decoded.image = resolveIPFSUrl(decoded.image);
        }
        return { metadata: decoded };
      }

      // Handle data URI (inline JSON)
      if (tokenURI.startsWith("data:application/json,")) {
        const json = decodeURIComponent(tokenURI.replace("data:application/json,", ""));
        const decoded = JSON.parse(json);
        if (decoded.image) {
          decoded.image = resolveIPFSUrl(decoded.image);
        }
        return { metadata: decoded };
      }

      // IPFS or HTTP
      const response = await fetchFromIPFSWithRetry(tokenURI);
      if (response && response.ok) {
        const text = await response.text();
        try {
          const metadata = JSON.parse(text);
          if (metadata.image) {
            metadata.image = resolveIPFSUrl(metadata.image);
          }
          return { metadata };
        } catch (parseErr) {
          return { metadata: undefined, error: "Invalid JSON in metadata" };
        }
      }
      
      return { metadata: undefined, error: "Failed to fetch metadata from IPFS" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn("[NFT] Failed to fetch metadata:", tokenURI, err);
      return { metadata: undefined, error: msg };
    }
  }, []);

  // Discover owned token IDs via Transfer events
  const fetchOwnedTokenIdsByEvents = useCallback(
    async (ownerAddress: string): Promise<string[]> => {
      const owner = ownerAddress.toLowerCase();
      const toTopic = addressToTopic(owner);
      const zeroTopic = addressToTopic(ZERO_ADDRESS);
      
      let latestBlock: number;
      try {
        latestBlock = await getBlockNumber();
      } catch {
        latestBlock = 25000000; // Fallback to reasonable recent block
      }

      // Strategy 1: Look for mint events (from zero address to owner)
      // This avoids null wildcards which some RPCs reject
      let mintLogs: RpcLog[] = [];
      try {
        mintLogs = await getTransferLogsChunked(
          [TRANSFER_TOPIC, zeroTopic, toTopic],
          0,
          latestBlock,
          500000
        );
        console.log(`[NFT] Found ${mintLogs.length} mint events`);
      } catch (err) {
        console.warn("[NFT] Mint event query failed:", err);
      }

      // Strategy 2: Look for transfers TO this address (may include secondary sales)
      // Only try if mint logs are empty and within last 1M blocks
      let transferLogs: RpcLog[] = [];
      if (mintLogs.length === 0) {
        try {
          // Use explicit from address instead of null wildcard for better RPC compatibility
          // Query last 1M blocks for transfers to this address
          const startBlock = Math.max(0, latestBlock - 1000000);
          transferLogs = await getTransferLogsChunked(
            [TRANSFER_TOPIC, null, toTopic],
            startBlock,
            latestBlock,
            200000
          );
          console.log(`[NFT] Found ${transferLogs.length} transfer-to events in recent blocks`);
        } catch (err) {
          console.warn("[NFT] Transfer-to query failed (expected for some RPCs):", err);
        }
      }

      const allLogs = [...mintLogs, ...transferLogs];
      
      // Extract candidate token IDs
      const candidateIds = new Set<string>();
      for (const log of allLogs) {
        if (!log.topics || log.topics.length < 4) continue;
        if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
        try {
          candidateIds.add(BigInt(log.topics[3]).toString());
        } catch {
          // Invalid topic, skip
        }
      }

      const candidates = Array.from(candidateIds);
      console.log(`[NFT] Validating ${candidates.length} candidate token IDs...`);

      // Validate ownership in parallel (batched)
      const owned: string[] = [];
      const batchSize = 5;
      
      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (id) => {
            const currentOwner = await fetchOwnerOf(BigInt(id));
            return { id, isOwned: currentOwner === owner };
          })
        );
        
        for (const { id, isOwned } of results) {
          if (isOwned) owned.push(id);
        }
      }

      // Sort newest-first (highest tokenId first)
      owned.sort((a, b) => Number(BigInt(b) - BigInt(a)));
      return owned;
    },
    [fetchOwnerOf]
  );

  // Fallback: scan recent token IDs to find owned ones
  const scanRecentTokenIds = useCallback(
    async (ownerAddress: string, targetBalance: number): Promise<string[]> => {
      const owner = ownerAddress.toLowerCase();
      const owned: string[] = [];
      
      try {
        // Get totalSupply
        const totalSupplyData = "0x18160ddd";
        const result = (await fetchWithPublicRPC("eth_call", [{ to: NFT_CONTRACT_ADDRESS, data: totalSupplyData }, "latest"])) as string;
        const totalSupply = parseInt(result, 16);
        
        if (totalSupply > 0) {
          console.log(`[NFT] Total supply: ${totalSupply}, scanning for ${targetBalance} owned tokens...`);
          
          // Scan from most recent token backwards, in parallel batches
          const scanLimit = Math.min(200, totalSupply);
          const batchSize = 10;
          
          for (let i = totalSupply; i > Math.max(0, totalSupply - scanLimit) && owned.length < targetBalance; i -= batchSize) {
            const batch: number[] = [];
            for (let j = 0; j < batchSize && (i - j) > 0; j++) {
              batch.push(i - j);
            }
            
            const results = await Promise.all(
              batch.map(async (tokenId) => {
                const currentOwner = await fetchOwnerOf(BigInt(tokenId));
                return { tokenId, isOwned: currentOwner === owner };
              })
            );
            
            for (const { tokenId, isOwned } of results) {
              if (isOwned && owned.length < targetBalance) {
                owned.push(tokenId.toString());
              }
            }
          }
        }
      } catch (err) {
        console.warn("[NFT] Scan fallback failed:", err);
      }
      
      return owned;
    },
    [fetchOwnerOf]
  );

  // Progressive metadata loading - update state as each NFT loads
  const loadNFTMetadataProgressively = useCallback(
    async (
      tokenIds: string[],
      balance: number,
      debug: DebugPanel,
      onUpdate: (nfts: NFTItem[]) => void
    ) => {
      // Start with loading placeholders for all discovered tokens
      const nfts: NFTItem[] = tokenIds.map((id) => ({
        tokenId: id,
        tokenURI: "",
        isLoading: true,
        hasError: false,
        metadata: {
          name: `Loading NFT #${id}...`,
          description: "Fetching metadata...",
        },
      }));

      // Immediately show loading state
      onUpdate([...nfts]);

      // Load each NFT's metadata independently
      const loadToken = async (index: number, tokenId: string) => {
        const tokenIdBig = BigInt(tokenId);
        
        // Fetch tokenURI
        let tokenURI: string | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          tokenURI = await fetchTokenURI(tokenIdBig);
          if (tokenURI) break;
          await new Promise((r) => setTimeout(r, 500));
        }

        if (tokenURI) {
          debug.tokenURIs[tokenId] = tokenURI;
        }

        // Fetch metadata
        const { metadata, error } = tokenURI
          ? await fetchMetadata(tokenURI)
          : { metadata: undefined, error: "No tokenURI found" };

        // Update this specific NFT
        nfts[index] = {
          tokenId,
          tokenURI: tokenURI ?? "",
          isLoading: false,
          hasError: !metadata,
          errorReason: error,
          metadata: metadata ?? {
            name: `MemoryMint #${tokenId}`,
            description: error || "Metadata unavailable",
          },
        };

        // Trigger UI update
        onUpdate([...nfts]);
      };

      // Load tokens in parallel batches for speed
      const batchSize = 3;
      for (let i = 0; i < tokenIds.length; i += batchSize) {
        const batch = tokenIds.slice(i, i + batchSize).map((id, j) => loadToken(i + j, id));
        await Promise.all(batch);
      }

      return nfts;
    },
    [fetchTokenURI, fetchMetadata]
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
          debug: null,
        });
        return;
      }

      if (fetchingRef.current && !forceRefresh) return;
      fetchingRef.current = true;

      console.log(`[NFT] Fetching collection for address: ${address}`);

      // Clear cached NFT state on force refresh
      setState((prev) => ({
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
        discoveryMethod: "none",
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

        // Fetch balance
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
          debug.discoveryMethod = "recent_mint";
        }

        // Try event-based discovery
        if (tokenIds.length < balance) {
          try {
            console.log("[NFT] Trying event-based discovery...");
            const eventTokenIds = await fetchOwnedTokenIdsByEvents(address);
            console.log("[NFT] Event discovery found:", eventTokenIds);
            tokenIds = Array.from(new Set([...tokenIds, ...eventTokenIds]));
            if (eventTokenIds.length > 0) {
              debug.discoveryMethod = "events";
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
              debug.discoveryMethod = "scan";
            }
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            console.warn("[NFT] Scan fallback failed:", errMsg);
            debug.errors.push(`Scan fallback: ${errMsg}`);
          }
        }

        // If still no token IDs but we have balance, show error state with retry option
        if (tokenIds.length === 0 && balance > 0) {
          const shouldRetry = retryCountRef.current < maxRetries;

          console.log(`[NFT] No token IDs found. Retry ${retryCountRef.current + 1}/${maxRetries}`);

          // Show placeholder NFTs
          const placeholders: NFTItem[] = Array.from({ length: balance }).map((_, i) => ({
            tokenId: shouldRetry ? `syncing-${i + 1}` : `pending-${i + 1}`,
            tokenURI: "",
            isLoading: shouldRetry,
            hasError: !shouldRetry,
            metadata: {
              name: shouldRetry ? `Syncing NFT ${i + 1}...` : `MemoryMint NFT ${i + 1}`,
              description: shouldRetry
                ? "Blockchain indexing in progress..."
                : "Token exists on-chain. Tap Refresh to load.",
            },
          }));

          setState({
            nfts: placeholders,
            isLoading: false,
            error: shouldRetry ? null : `Found ${balance} NFT(s) but couldn't retrieve details. Tap Refresh to retry.`,
            chainError: null,
            balance,
            debug,
          });

          // Auto-retry with exponential backoff
          if (shouldRetry) {
            retryCountRef.current++;
            const delay = Math.min(2000 * Math.pow(1.5, retryCountRef.current), 15000);
            console.log(`[NFT] Scheduling retry in ${delay}ms...`);
            setTimeout(() => {
              fetchingRef.current = false;
              fetchCollection(true);
            }, delay);
          }

          fetchingRef.current = false;
          return;
        }

        // Reset retry count on successful discovery
        retryCountRef.current = 0;

        // Load metadata progressively
        await loadNFTMetadataProgressively(tokenIds, balance, debug, (updatedNfts) => {
          setState((prev) => ({
            ...prev,
            nfts: updatedNfts,
            isLoading: false,
            error: null,
            chainError: null,
            balance,
            debug,
          }));
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch NFTs";
        debug.errors.push(msg);

        // If we have balance, show error placeholders
        if (debug.balance && debug.balance > 0) {
          const placeholders: NFTItem[] = Array.from({ length: debug.balance }).map((_, i) => ({
            tokenId: `error-${i + 1}`,
            tokenURI: "",
            isLoading: false,
            hasError: true,
            metadata: {
              name: `MemoryMint NFT ${i + 1}`,
              description: "Tap Refresh to load.",
            },
          }));

          setState({
            nfts: placeholders,
            isLoading: false,
            error: msg,
            chainError: null,
            balance: debug.balance,
            debug,
          });
          fetchingRef.current = false;
          return;
        }

        setState((prev) => ({ ...prev, isLoading: false, error: msg, debug }));
      } finally {
        fetchingRef.current = false;
      }
    },
    [
      address,
      ensureBaseNetwork,
      fetchBalance,
      fetchOwnedTokenIdsByEvents,
      loadNFTMetadataProgressively,
      scanRecentTokenIds,
    ]
  );

  // Auto-fetch on mount and address change
  useEffect(() => {
    retryCountRef.current = 0;
    fetchCollection();
  }, [fetchCollection]);

  // Auto-refresh after mint
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
        fetchCollection(true);
      }
    };

    window.addEventListener("memorymint:nft-minted", handler as EventListener);
    return () => window.removeEventListener("memorymint:nft-minted", handler as EventListener);
  }, [address, fetchCollection]);

  const refetch = useCallback(() => {
    attemptedSwitchRef.current = false;
    recentMintTokenIdsRef.current.clear();
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
