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

export interface NFTItem {
  tokenId: string;
  tokenURI: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  };
}

type DebugPanel = {
  address: string;
  chainId: string | null;
  contract: string;
  balance: number | null;
  discoveredTokenIds: string[];
  tokenURIs: Record<string, string>;
  errors: string[];
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

function topicToAddress(topic: string): string {
  return ("0x" + topic.slice(-40)).toLowerCase();
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

  const ensureBaseNetwork = useCallback(async (): Promise<{ ok: boolean; chainId: string | null }> => {
    if (!window.ethereum) {
      return { ok: false, chainId: null };
    }

    try {
      const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
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
              return { ok: false, chainId };
            }
          }

          return { ok: false, chainId };
        }
      }

      return { ok: false, chainId };
    } catch {
      return { ok: false, chainId: null };
    }
  }, []);

  const fetchBalance = useCallback(async (ownerAddress: string): Promise<number> => {
    // balanceOf(address) = 0x70a08231
    const paddedAddress = ownerAddress.toLowerCase().replace("0x", "").padStart(64, "0");
    const data = `0x70a08231${paddedAddress}`;

    const result = (await fetchWithPublicRPC("eth_call", [{ to: NFT_CONTRACT_ADDRESS, data }, "latest"])) as string;
    return parseInt(result, 16);
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
        return JSON.parse(atob(base64));
      }

      // IPFS
      if (tokenURI.startsWith("ipfs://")) {
        const cid = tokenURI.replace("ipfs://", "");
        const gateways = [
          "https://gateway.pinata.cloud/ipfs/",
          "https://ipfs.io/ipfs/",
          "https://cloudflare-ipfs.com/ipfs/",
          "https://dweb.link/ipfs/",
        ];

        for (const gateway of gateways) {
          try {
            const response = await fetch(`${gateway}${cid}`, { signal: AbortSignal.timeout(8000) });
            if (response.ok) return await response.json();
          } catch {
            // try next
          }
        }
        return undefined;
      }

      // HTTP
      if (tokenURI.startsWith("http")) {
        const response = await fetch(tokenURI, { signal: AbortSignal.timeout(10_000) });
        if (response.ok) return await response.json();
      }
    } catch {
      // ignore
    }

    return undefined;
  }, []);

  const fetchOwnedTokenIdsByEvents = useCallback(async (ownerAddress: string): Promise<string[]> => {
    const toTopic = addressToTopic(ownerAddress);

    // incoming: Transfer(*, to=owner, tokenId)
    const incoming = await getTransferLogsWithFallback([TRANSFER_TOPIC, null, toTopic]);
    // outgoing: Transfer(from=owner, *, tokenId)
    const outgoing = await getTransferLogsWithFallback([TRANSFER_TOPIC, toTopic, null]);

    const all = [...incoming, ...outgoing];

    // Sort deterministically so set updates are correct
    all.sort((a, b) => {
      const ab = parseInt(a.blockNumber, 16);
      const bb = parseInt(b.blockNumber, 16);
      if (ab !== bb) return ab - bb;
      return parseInt(a.logIndex, 16) - parseInt(b.logIndex, 16);
    });

    const owner = ownerAddress.toLowerCase();
    const owned = new Set<string>();

    for (const log of all) {
      if (!log.topics || log.topics.length < 4) continue;
      if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;

      const from = topicToAddress(log.topics[1]);
      const to = topicToAddress(log.topics[2]);
      const tokenId = BigInt(log.topics[3]).toString();

      if (to === owner) owned.add(tokenId);
      if (from === owner) owned.delete(tokenId);
      if (to === ZERO_ADDRESS) owned.delete(tokenId);
    }

    return Array.from(owned);
  }, []);

  const fetchCollection = useCallback(
    async (forceRefresh = false) => {
      if (!address) {
        setState({ nfts: [], isLoading: false, error: null, chainError: null, balance: null, debug: null });
        return;
      }

      if (fetchingRef.current && !forceRefresh) return;
      fetchingRef.current = true;

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
      };

      try {
        const net = await ensureBaseNetwork();
        debug.chainId = net.chainId;

        if (!net.ok) {
          setState({
            nfts: [],
            isLoading: false,
            error: null,
            chainError: "Wrong network. Please switch to Base Mainnet.",
            balance: null,
            debug,
          });
          return;
        }

        // Direct on-chain validation (never show empty state if balance > 0)
        const balance = await fetchBalance(address);
        debug.balance = balance;

        if (balance === 0) {
          setState({
            nfts: [],
            isLoading: false,
            error: null,
            chainError: null,
            balance,
            debug,
          });
          return;
        }

        let tokenIds: string[] = [];
        try {
          tokenIds = await fetchOwnedTokenIdsByEvents(address);
          debug.discoveredTokenIds = tokenIds;
        } catch (e) {
          debug.errors.push(e instanceof Error ? e.message : String(e));
        }

        // Critical fallback: never show "No NFTs" when balance > 0
        // If we cannot discover tokenIds (RPC/indexing limitations), render placeholders.
        if (tokenIds.length === 0) {
          const placeholders: NFTItem[] = Array.from({ length: Math.max(1, balance) }).map((_, i) => ({
            tokenId: `pending-${i + 1}`,
            tokenURI: "",
            metadata: {
              name: `MemoryMint (indexing...) #${i + 1}`,
              description: "Your NFTs are on-chain. Token IDs are still being discovered.",
            },
          }));

          setState({
            nfts: placeholders,
            isLoading: false,
            error: null,
            chainError: null,
            balance,
            debug,
          });
          return;
        }

        // Fetch tokenURI + metadata; if anything fails we still keep the NFT card.
        const items: NFTItem[] = [];
        for (const id of tokenIds) {
          const tokenIdBig = BigInt(id);
          const tokenURI = await fetchTokenURI(tokenIdBig);
          if (tokenURI) debug.tokenURIs[id] = tokenURI;

          const item: NFTItem = {
            tokenId: id,
            tokenURI: tokenURI ?? "",
          };

          if (tokenURI) {
            const md = await fetchMetadata(tokenURI);
            if (md) {
              // Convert IPFS image URLs to HTTPS gateway URLs
              if (md.image?.startsWith("ipfs://")) {
                md.image = md.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
              }
              item.metadata = md;
            } else {
              item.metadata = { name: `MemoryMint #${id}` };
            }
          } else {
            item.metadata = { name: `MemoryMint #${id}` };
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
          const placeholders: NFTItem[] = Array.from({ length: Math.max(1, debug.balance) }).map((_, i) => ({
            tokenId: `pending-${i + 1}`,
            tokenURI: "",
            metadata: {
              name: `MemoryMint (loading...) #${i + 1}`,
              description: "Your NFTs are on-chain, but metadata is temporarily unavailable.",
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
          return;
        }

        setState(prev => ({ ...prev, isLoading: false, error: msg, debug }));
      } finally {
        fetchingRef.current = false;
      }
    },
    [address, ensureBaseNetwork, fetchBalance, fetchMetadata, fetchOwnedTokenIdsByEvents, fetchTokenURI]
  );

  // Auto-fetch on mount and address change
  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  // Auto-refresh after mint (instant refresh fix)
  useEffect(() => {
    const handler = (evt: Event) => {
      const e = evt as CustomEvent<{ address?: string; tokenIds?: string[]; txHash?: string }>;
      const mintedTo = e.detail?.address?.toLowerCase();
      if (mintedTo && mintedTo === address?.toLowerCase()) {
        fetchCollection(true);
      }
    };

    window.addEventListener("memorymint:nft-minted", handler as EventListener);
    return () => window.removeEventListener("memorymint:nft-minted", handler as EventListener);
  }, [address, fetchCollection]);

  const refetch = useCallback(() => {
    attemptedSwitchRef.current = false; // allow switch prompt again on manual refresh
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
