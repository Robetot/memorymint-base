import { useState, useCallback, useEffect, useRef } from 'react';

// Must match the contract address in useNFTMint.ts
const NFT_CONTRACT_ADDRESS = '0xBf44A549C390923fD00B17E867804355E93Bf4c0';

// Base Mainnet chain ID
const BASE_CHAIN_ID = '0x2105';

// Multiple RPC endpoints for reliability
const RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.drpc.org',
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

interface FetchState {
  nfts: NFTItem[];
  isLoading: boolean;
  error: string | null;
  chainError: string | null;
}

async function fetchWithRPC(method: string, params: unknown[]): Promise<unknown> {
  // Try wallet provider first (uses user's connected RPC)
  if (window.ethereum) {
    try {
      return await window.ethereum.request({ method, params });
    } catch (err) {
      console.warn('Wallet RPC failed, trying public endpoints...', err);
    }
  }

  // Fallback to public RPC endpoints
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (err) {
      console.warn(`RPC ${rpc} failed, trying next...`);
      continue;
    }
  }
  throw new Error('All RPC endpoints failed');
}

export function useNFTCollection(address: string | null) {
  const [state, setState] = useState<FetchState>({
    nfts: [],
    isLoading: false,
    error: null,
    chainError: null,
  });
  const fetchingRef = useRef(false);

  // Check if connected to Base network
  const checkNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return true; // If no wallet, we'll use public RPC
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      return chainId.toLowerCase() === BASE_CHAIN_ID.toLowerCase();
    } catch {
      return false;
    }
  }, []);

  // Fetch balance using balanceOf(address)
  const fetchBalance = useCallback(async (ownerAddress: string): Promise<number> => {
    const paddedAddress = ownerAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const data = `0x70a08231${paddedAddress}`;

    const result = await fetchWithRPC('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
    return parseInt(result as string, 16);
  }, []);

  // Get total supply to know the range of tokens
  const fetchTotalSupply = useCallback(async (): Promise<number> => {
    // totalSupply() selector
    const data = '0x18160ddd';
    const result = await fetchWithRPC('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
    return parseInt(result as string, 16);
  }, []);

  // Check owner of a specific token
  const fetchOwnerOf = useCallback(async (tokenId: number): Promise<string | null> => {
    const paddedTokenId = tokenId.toString(16).padStart(64, '0');
    const data = `0x6352211e${paddedTokenId}`;

    try {
      const result = await fetchWithRPC('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      if (result && typeof result === 'string' && result.length >= 66) {
        return '0x' + result.slice(-40);
      }
    } catch {
      // Token doesn't exist
    }
    return null;
  }, []);

  // Fetch tokenURI for a token
  const fetchTokenURI = useCallback(async (tokenId: number): Promise<string | null> => {
    const paddedTokenId = tokenId.toString(16).padStart(64, '0');
    const data = `0xc87b56dd${paddedTokenId}`;

    try {
      const result = await fetchWithRPC('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']) as string;
      
      if (result && result.length > 130) {
        // Decode ABI-encoded string
        const hex = result.slice(2);
        const length = parseInt(hex.slice(64, 128), 16);
        if (length > 0 && length < 10000) {
          const stringHex = hex.slice(128, 128 + length * 2);
          const bytes = [];
          for (let i = 0; i < stringHex.length; i += 2) {
            bytes.push(parseInt(stringHex.substr(i, 2), 16));
          }
          return String.fromCharCode(...bytes);
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch tokenURI for token ${tokenId}:`, err);
    }
    return null;
  }, []);

  // Fetch metadata from URI
  const fetchMetadata = useCallback(async (tokenURI: string): Promise<NFTItem['metadata']> => {
    if (!tokenURI) return undefined;

    try {
      // Handle data URI (base64 JSON)
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const base64 = tokenURI.replace('data:application/json;base64,', '');
        return JSON.parse(atob(base64));
      }

      // Handle IPFS URI
      let url = tokenURI;
      if (tokenURI.startsWith('ipfs://')) {
        const cid = tokenURI.replace('ipfs://', '');
        // Try multiple gateways
        const gateways = [
          'https://gateway.pinata.cloud/ipfs/',
          'https://ipfs.io/ipfs/',
          'https://cloudflare-ipfs.com/ipfs/',
        ];
        
        for (const gateway of gateways) {
          try {
            const response = await fetch(`${gateway}${cid}`, {
              signal: AbortSignal.timeout(8000),
            });
            if (response.ok) {
              return await response.json();
            }
          } catch {
            continue;
          }
        }
        return undefined;
      }

      // Handle HTTP URL
      if (url.startsWith('http')) {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        return await response.json();
      }
    } catch (err) {
      console.warn('Failed to fetch metadata:', err);
    }
    return undefined;
  }, []);

  // Main fetch function - scans all tokens to find user's NFTs
  const fetchCollection = useCallback(async (forceRefresh = false) => {
    if (!address) {
      setState({ nfts: [], isLoading: false, error: null, chainError: null });
      return;
    }

    // Prevent concurrent fetches
    if (fetchingRef.current && !forceRefresh) return;
    fetchingRef.current = true;

    setState(prev => ({ ...prev, isLoading: true, error: null, chainError: null }));

    try {
      // Check network
      const isBase = await checkNetwork();
      if (!isBase && window.ethereum) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          chainError: 'Please switch to Base network to view your NFTs',
        }));
        fetchingRef.current = false;
        return;
      }

      // First check balance
      const balance = await fetchBalance(address);
      console.log(`NFT balance for ${address}: ${balance}`);

      if (balance === 0) {
        setState({ nfts: [], isLoading: false, error: null, chainError: null });
        fetchingRef.current = false;
        return;
      }

      // Get total supply to know range
      const totalSupply = await fetchTotalSupply();
      console.log(`Total NFT supply: ${totalSupply}`);

      // Scan tokens to find ones owned by this address
      // Start from token 1 (contract starts at 1)
      const ownedTokenIds: number[] = [];
      const normalizedAddress = address.toLowerCase();

      // Scan in batches for efficiency
      const batchSize = 20;
      for (let start = 1; start <= totalSupply && ownedTokenIds.length < balance; start += batchSize) {
        const end = Math.min(start + batchSize - 1, totalSupply);
        
        const promises = [];
        for (let tokenId = start; tokenId <= end; tokenId++) {
          promises.push(
            fetchOwnerOf(tokenId).then(owner => ({
              tokenId,
              owner: owner?.toLowerCase(),
            }))
          );
        }
        
        const results = await Promise.all(promises);
        for (const { tokenId, owner } of results) {
          if (owner === normalizedAddress) {
            ownedTokenIds.push(tokenId);
          }
        }
      }

      console.log(`Found ${ownedTokenIds.length} NFTs owned by ${address}:`, ownedTokenIds);

      // Fetch metadata for each owned token
      const items: NFTItem[] = [];
      for (const tokenId of ownedTokenIds) {
        const tokenURI = await fetchTokenURI(tokenId);
        const item: NFTItem = {
          tokenId: tokenId.toString(),
          tokenURI: tokenURI || '',
        };

        if (tokenURI) {
          item.metadata = await fetchMetadata(tokenURI);
          // Convert IPFS image URLs to gateway URLs
          if (item.metadata?.image?.startsWith('ipfs://')) {
            item.metadata.image = item.metadata.image.replace(
              'ipfs://',
              'https://gateway.pinata.cloud/ipfs/'
            );
          }
        }

        items.push(item);
      }

      setState({ nfts: items, isLoading: false, error: null, chainError: null });
    } catch (err) {
      console.error('Error fetching NFT collection:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch NFTs',
      }));
    } finally {
      fetchingRef.current = false;
    }
  }, [address, checkNetwork, fetchBalance, fetchTotalSupply, fetchOwnerOf, fetchTokenURI, fetchMetadata]);

  // Auto-fetch on mount and address change
  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  // Return a proper refetch that forces refresh
  const refetch = useCallback(() => {
    return fetchCollection(true);
  }, [fetchCollection]);

  return {
    nfts: state.nfts,
    isLoading: state.isLoading,
    error: state.error,
    chainError: state.chainError,
    refetch,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
