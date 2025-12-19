import { useState, useCallback, useEffect, useRef } from 'react';

// Must match the contract address in useNFTMint.ts
const NFT_CONTRACT_ADDRESS = '0xBf44A549C390923fD00B17E867804355E93Bf4c0';

// Base Mainnet chain ID
const BASE_CHAIN_ID = '0x2105';

// Multiple RPC endpoints for reliability - use public RPCs for reads
const RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.drpc.org',
  'https://1rpc.io/base',
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
  debugInfo: string | null;
}

// Use public RPC directly for read operations - more reliable than wallet provider
async function fetchWithPublicRPC(method: string, params: unknown[]): Promise<unknown> {
  const errors: string[] = [];
  
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
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
      
      console.log(`[NFT] RPC ${rpc} succeeded for ${method}`);
      return data.result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${rpc}: ${msg}`);
      continue;
    }
  }
  
  throw new Error(`All RPCs failed: ${errors.join('; ')}`);
}

export function useNFTCollection(address: string | null) {
  const [state, setState] = useState<FetchState>({
    nfts: [],
    isLoading: false,
    error: null,
    chainError: null,
    debugInfo: null,
  });
  const fetchingRef = useRef(false);

  // Check if connected to Base network (optional - we use public RPC anyway)
  const checkNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return true;
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      const isBase = chainId.toLowerCase() === BASE_CHAIN_ID.toLowerCase();
      console.log(`[NFT] Chain check: ${chainId} (isBase: ${isBase})`);
      return isBase;
    } catch (err) {
      console.warn('[NFT] Chain check failed:', err);
      return true; // Assume base if we can't check
    }
  }, []);

  // Fetch balance using balanceOf(address)
  const fetchBalance = useCallback(async (ownerAddress: string): Promise<number> => {
    // balanceOf(address) = 0x70a08231
    const paddedAddress = ownerAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const data = `0x70a08231${paddedAddress}`;
    
    console.log(`[NFT] Fetching balance for ${ownerAddress}`);
    console.log(`[NFT] Contract: ${NFT_CONTRACT_ADDRESS}`);
    console.log(`[NFT] Call data: ${data}`);

    const result = await fetchWithPublicRPC('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
    const balance = parseInt(result as string, 16);
    console.log(`[NFT] Balance result: ${result} = ${balance}`);
    return balance;
  }, []);

  // Get next token ID to know the range of tokens
  // We use nextTokenId() instead of totalSupply() because it's more reliable
  const fetchNextTokenId = useCallback(async (): Promise<number> => {
    // nextTokenId() = 0x75794a3c (returns the next token ID to be minted)
    const data = '0x75794a3c';
    console.log('[NFT] Fetching next token ID...');
    
    const result = await fetchWithPublicRPC('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
    const nextId = parseInt(result as string, 16);
    console.log(`[NFT] Next token ID: ${result} = ${nextId}`);
    return nextId;
  }, []);

  // Check owner of a specific token
  const fetchOwnerOf = useCallback(async (tokenId: number): Promise<string | null> => {
    // ownerOf(uint256) = 0x6352211e
    const paddedTokenId = tokenId.toString(16).padStart(64, '0');
    const data = `0x6352211e${paddedTokenId}`;

    try {
      const result = await fetchWithPublicRPC('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      if (result && typeof result === 'string' && result.length >= 66) {
        const owner = '0x' + result.slice(-40);
        return owner;
      }
    } catch (err) {
      // Token might not exist
      console.warn(`[NFT] ownerOf(${tokenId}) failed:`, err);
    }
    return null;
  }, []);

  // Fetch tokenURI for a token
  const fetchTokenURI = useCallback(async (tokenId: number): Promise<string | null> => {
    // tokenURI(uint256) = 0xc87b56dd
    const paddedTokenId = tokenId.toString(16).padStart(64, '0');
    const data = `0xc87b56dd${paddedTokenId}`;

    try {
      const result = await fetchWithPublicRPC('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']) as string;
      
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
      console.warn(`[NFT] tokenURI(${tokenId}) failed:`, err);
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
      if (tokenURI.startsWith('ipfs://')) {
        const cid = tokenURI.replace('ipfs://', '');
        const gateways = [
          'https://gateway.pinata.cloud/ipfs/',
          'https://ipfs.io/ipfs/',
          'https://cloudflare-ipfs.com/ipfs/',
          'https://dweb.link/ipfs/',
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
      if (tokenURI.startsWith('http')) {
        const response = await fetch(tokenURI, { signal: AbortSignal.timeout(10000) });
        return await response.json();
      }
    } catch (err) {
      console.warn('[NFT] Failed to fetch metadata:', err);
    }
    return undefined;
  }, []);

  // Main fetch function - scans all tokens to find user's NFTs
  const fetchCollection = useCallback(async (forceRefresh = false) => {
    if (!address) {
      console.log('[NFT] No address provided, clearing NFTs');
      setState({ nfts: [], isLoading: false, error: null, chainError: null, debugInfo: null });
      return;
    }

    // Prevent concurrent fetches
    if (fetchingRef.current && !forceRefresh) {
      console.log('[NFT] Already fetching, skipping');
      return;
    }
    fetchingRef.current = true;

    console.log('[NFT] Starting collection fetch for:', address);
    setState(prev => ({ ...prev, isLoading: true, error: null, chainError: null, debugInfo: 'Starting fetch...' }));

    try {
      // Check network (informational only - we use public RPC)
      const isBase = await checkNetwork();
      if (!isBase && window.ethereum) {
        console.log('[NFT] Not on Base network, showing warning');
        setState(prev => ({
          ...prev,
          isLoading: false,
          chainError: 'Switch to Base network for best experience',
          debugInfo: 'Wrong network detected',
        }));
        // Continue anyway - we use public RPC
      }

      // First check balance
      setState(prev => ({ ...prev, debugInfo: 'Checking NFT balance...' }));
      const balance = await fetchBalance(address);
      console.log(`[NFT] Balance for ${address}: ${balance}`);

      if (balance === 0) {
        console.log('[NFT] Balance is 0, no NFTs owned');
        setState({ 
          nfts: [], 
          isLoading: false, 
          error: null, 
          chainError: null,
          debugInfo: `Balance: 0 NFTs for ${address.slice(0, 10)}...`
        });
        fetchingRef.current = false;
        return;
      }

      // Get next token ID to know range (tokens are 1 to nextTokenId-1)
      setState(prev => ({ ...prev, debugInfo: `Found ${balance} NFTs, scanning tokens...` }));
      const nextTokenId = await fetchNextTokenId();
      const totalSupply = nextTokenId - 1; // Tokens are 1-indexed, so last token is nextTokenId - 1
      console.log(`[NFT] Next token ID: ${nextTokenId}, total minted: ${totalSupply}`);

      // Scan tokens to find ones owned by this address
      const ownedTokenIds: number[] = [];
      const normalizedAddress = address.toLowerCase();

      console.log(`[NFT] Scanning tokens 1-${totalSupply} for owner ${normalizedAddress}`);

      // Scan in batches for efficiency
      const batchSize = 10;
      for (let start = 1; start <= totalSupply && ownedTokenIds.length < balance; start += batchSize) {
        const end = Math.min(start + batchSize - 1, totalSupply);
        setState(prev => ({ ...prev, debugInfo: `Scanning tokens ${start}-${end}...` }));
        
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
          console.log(`[NFT] Token ${tokenId} owner: ${owner}`);
          if (owner === normalizedAddress) {
            console.log(`[NFT] ✓ Token ${tokenId} owned by user!`);
            ownedTokenIds.push(tokenId);
          }
        }
      }

      console.log(`[NFT] Found ${ownedTokenIds.length} NFTs:`, ownedTokenIds);

      if (ownedTokenIds.length === 0) {
        console.log('[NFT] No owned tokens found despite balance > 0');
        setState({ 
          nfts: [], 
          isLoading: false, 
          error: null, 
          chainError: null,
          debugInfo: `Balance shows ${balance} but no tokens found in scan`
        });
        fetchingRef.current = false;
        return;
      }

      // Fetch metadata for each owned token
      setState(prev => ({ ...prev, debugInfo: `Loading metadata for ${ownedTokenIds.length} NFTs...` }));
      const items: NFTItem[] = [];
      
      for (const tokenId of ownedTokenIds) {
        const tokenURI = await fetchTokenURI(tokenId);
        console.log(`[NFT] Token ${tokenId} URI:`, tokenURI);
        
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

      console.log(`[NFT] Final collection:`, items);
      setState({ 
        nfts: items, 
        isLoading: false, 
        error: null, 
        chainError: null,
        debugInfo: `Loaded ${items.length} NFTs`
      });
    } catch (err) {
      console.error('[NFT] Error fetching collection:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch NFTs',
        debugInfo: `Error: ${err instanceof Error ? err.message : 'Unknown'}`
      }));
    } finally {
      fetchingRef.current = false;
    }
  }, [address, checkNetwork, fetchBalance, fetchNextTokenId, fetchOwnerOf, fetchTokenURI, fetchMetadata]);

  // Auto-fetch on mount and address change
  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  // Return a proper refetch that forces refresh
  const refetch = useCallback(() => {
    console.log('[NFT] Manual refresh triggered');
    fetchingRef.current = false; // Reset the lock
    return fetchCollection(true);
  }, [fetchCollection]);

  return {
    nfts: state.nfts,
    isLoading: state.isLoading,
    error: state.error,
    chainError: state.chainError,
    debugInfo: state.debugInfo,
    refetch,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
