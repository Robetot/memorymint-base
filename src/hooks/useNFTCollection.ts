import { useState, useCallback, useEffect } from 'react';

const NFT_CONTRACT_ADDRESS = '0xBf44A549C390923fD00B17E867804355E93Bf4c0';

// ERC721 Enumerable ABI for fetching owned tokens
const ERC721_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
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

export function useNFTCollection(address: string | null) {
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (): Promise<number> => {
    if (!window.ethereum || !address) return 0;

    try {
      // Encode balanceOf(address) call
      const paddedAddress = address.toLowerCase().replace('0x', '').padStart(64, '0');
      const data = `0x70a08231${paddedAddress}`;

      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest'],
      }) as string;

      return parseInt(result, 16);
    } catch (err) {
      console.error('Error fetching balance:', err);
      return 0;
    }
  }, [address]);

  const fetchTokenByIndex = useCallback(async (index: number): Promise<string | null> => {
    if (!window.ethereum || !address) return null;

    try {
      const paddedAddress = address.toLowerCase().replace('0x', '').padStart(64, '0');
      const paddedIndex = index.toString(16).padStart(64, '0');
      const data = `0x2f745c59${paddedAddress}${paddedIndex}`;

      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest'],
      }) as string;

      return parseInt(result, 16).toString();
    } catch (err) {
      console.error('Error fetching token by index:', err);
      return null;
    }
  }, [address]);

  const fetchTokenURI = useCallback(async (tokenId: string): Promise<string | null> => {
    if (!window.ethereum) return null;

    try {
      const paddedTokenId = parseInt(tokenId).toString(16).padStart(64, '0');
      const data = `0xc87b56dd${paddedTokenId}`;

      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest'],
      }) as string;

      // Decode the string from the result
      if (result && result.length > 2) {
        // The result is ABI encoded - skip offset and length, then decode
        const hex = result.slice(2);
        if (hex.length >= 128) {
          const length = parseInt(hex.slice(64, 128), 16);
          const stringHex = hex.slice(128, 128 + length * 2);
          const bytes = [];
          for (let i = 0; i < stringHex.length; i += 2) {
            bytes.push(parseInt(stringHex.substr(i, 2), 16));
          }
          return String.fromCharCode(...bytes);
        }
      }
      return null;
    } catch (err) {
      console.error('Error fetching token URI:', err);
      return null;
    }
  }, []);

  const fetchFromIPFS = useCallback(async (cid: string): Promise<any> => {
    const gateways = [
      'https://ipfs.io/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/',
    ];

    for (const gateway of gateways) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${gateway}${cid}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.warn(`Gateway ${gateway} failed, trying next...`);
        continue;
      }
    }
    throw new Error('All IPFS gateways failed');
  }, []);

  const parseMetadata = useCallback(async (tokenURI: string): Promise<NFTItem['metadata']> => {
    try {
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const base64 = tokenURI.replace('data:application/json;base64,', '');
        const json = atob(base64);
        return JSON.parse(json);
      } else if (tokenURI.startsWith('ipfs://')) {
        const cid = tokenURI.replace('ipfs://', '');
        return await fetchFromIPFS(cid);
      } else if (tokenURI.startsWith('http')) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(tokenURI, { signal: controller.signal });
        clearTimeout(timeout);
        return await response.json();
      }
    } catch (err) {
      console.error('Error parsing metadata:', err);
    }
    return undefined;
  }, [fetchFromIPFS]);

  const fetchCollection = useCallback(async () => {
    if (!address || !window.ethereum) {
      setNfts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const balance = await fetchBalance();
      console.log(`Found ${balance} NFTs for address ${address}`);

      if (balance === 0) {
        setNfts([]);
        setIsLoading(false);
        return;
      }

      const items: NFTItem[] = [];

      for (let i = 0; i < balance; i++) {
        const tokenId = await fetchTokenByIndex(i);
        if (tokenId) {
          const tokenURI = await fetchTokenURI(tokenId);
          const item: NFTItem = { tokenId, tokenURI: tokenURI || '' };
          
          if (tokenURI) {
            item.metadata = await parseMetadata(tokenURI);
          }
          
          items.push(item);
        }
      }

      setNfts(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch collection';
      console.error('Error fetching collection:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [address, fetchBalance, fetchTokenByIndex, fetchTokenURI, parseMetadata]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  return {
    nfts,
    isLoading,
    error,
    refetch: fetchCollection,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
