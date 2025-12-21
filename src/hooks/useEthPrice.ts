import { useState, useEffect, useCallback } from 'react';

const PRICE_CACHE_DURATION = 60000; // 1 minute cache
const AI_FEE_USD = 0.04;
const TREASURY_ADDRESS = '0xdb265232cf6c684b8e2d198d2b48a982cf390c90';

interface PriceState {
  ethPrice: number | null;
  aiFeeWei: bigint | null;
  aiFeeEth: string | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

let cachedPrice: { price: number; timestamp: number } | null = null;

export function useEthPrice() {
  const [priceState, setPriceState] = useState<PriceState>({
    ethPrice: cachedPrice?.price || null,
    aiFeeWei: null,
    aiFeeEth: null,
    isLoading: false,
    error: null,
    lastUpdated: cachedPrice?.timestamp || null,
  });

  const calculateAiFee = useCallback((ethPrice: number) => {
    // Calculate $0.04 in ETH
    const aiFeeEthNum = AI_FEE_USD / ethPrice;
    
    // Convert to wei (18 decimals) and round up to avoid underpayment
    const aiFeeWei = BigInt(Math.ceil(aiFeeEthNum * 1e18));
    
    // Format for display (6 decimal places)
    const aiFeeEth = aiFeeEthNum.toFixed(6);
    
    return { aiFeeWei, aiFeeEth };
  }, []);

  const fetchEthPrice = useCallback(async (force = false) => {
    // Check cache first
    if (!force && cachedPrice && Date.now() - cachedPrice.timestamp < PRICE_CACHE_DURATION) {
      const { aiFeeWei, aiFeeEth } = calculateAiFee(cachedPrice.price);
      setPriceState({
        ethPrice: cachedPrice.price,
        aiFeeWei,
        aiFeeEth,
        isLoading: false,
        error: null,
        lastUpdated: cachedPrice.timestamp,
      });
      return cachedPrice.price;
    }

    setPriceState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Use CoinGecko API (free, no key required)
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch ETH price');
      }

      const data = await response.json();
      const ethPrice = data.ethereum.usd;

      if (!ethPrice || ethPrice <= 0) {
        throw new Error('Invalid ETH price received');
      }

      // Update cache
      cachedPrice = { price: ethPrice, timestamp: Date.now() };
      
      const { aiFeeWei, aiFeeEth } = calculateAiFee(ethPrice);

      setPriceState({
        ethPrice,
        aiFeeWei,
        aiFeeEth,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });

      return ethPrice;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch ETH price';
      
      // If we have cached price, use it as fallback
      if (cachedPrice) {
        const { aiFeeWei, aiFeeEth } = calculateAiFee(cachedPrice.price);
        setPriceState({
          ethPrice: cachedPrice.price,
          aiFeeWei,
          aiFeeEth,
          isLoading: false,
          error: null, // Don't show error if we have fallback
          lastUpdated: cachedPrice.timestamp,
        });
        return cachedPrice.price;
      }

      setPriceState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMsg,
      }));
      return null;
    }
  }, [calculateAiFee]);

  // Fetch price on mount
  useEffect(() => {
    fetchEthPrice();
  }, [fetchEthPrice]);

  return {
    ...priceState,
    refreshPrice: () => fetchEthPrice(true),
    AI_FEE_USD,
    TREASURY_ADDRESS,
  };
}
