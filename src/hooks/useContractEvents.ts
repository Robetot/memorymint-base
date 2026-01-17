import { useState, useEffect, useCallback, useRef } from 'react';
import { decodeEventLog } from 'viem';
import {
  NFT_CONTRACT_ADDRESS_V3,
  CONTRACT_EVENTS_V3,
  RPC_ENDPOINTS,
  TRANSFER_EVENT_TOPIC,
  ZERO_ADDRESS,
} from '@/contracts/MemoryMintContractV3';

// ============ TYPES ============
export interface TransferEvent {
  type: 'Transfer';
  from: string;
  to: string;
  tokenId: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface NFTMintedEvent {
  type: 'NFTMinted';
  to: string;
  tokenId: string;
  tokenURI: string;
  level: number;
  rarity: number;
  pricePaid: bigint;
  currency: 'ETH' | 'USDC';
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface BonusClaimedEvent {
  type: 'BonusClaimed';
  user: string;
  levelId: number;
  amount: bigint;
  currency: 'ETH' | 'USDC';
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export type ContractEvent = TransferEvent | NFTMintedEvent | BonusClaimedEvent;

export interface EventsState {
  events: ContractEvent[];
  isListening: boolean;
  error: string | null;
  lastBlock: number;
}

// ============ HELPER FUNCTIONS ============
async function rpcCall(method: string, params: unknown[], timeout = 8000): Promise<unknown> {
  const errors: string[] = [];

  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        errors.push(`${endpoint}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (data.error) {
        errors.push(`${endpoint}: ${data.error.message}`);
        continue;
      }

      return data.result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${endpoint}: ${msg}`);
      continue;
    }
  }

  throw new Error(`All RPCs failed: ${errors.join('; ')}`);
}

// Event topic signatures
const NFT_MINTED_TOPIC = '0x' + Array.from(
  new TextEncoder().encode('NFTMinted(address,uint256,string,uint8,uint8,uint256,uint8)')
).map(b => b.toString(16).padStart(2, '0')).join('');

const BONUS_CLAIMED_TOPIC = '0x' + Array.from(
  new TextEncoder().encode('BonusClaimed(address,uint256,uint256,uint8)')
).map(b => b.toString(16).padStart(2, '0')).join('');

// ============ HOOK ============
export function useContractEvents(walletAddress?: string) {
  const [state, setState] = useState<EventsState>({
    events: [],
    isListening: false,
    error: null,
    lastBlock: 0,
  });

  const pollingRef = useRef<number | null>(null);
  const lastBlockRef = useRef<number>(0);
  const eventsRef = useRef<ContractEvent[]>([]);

  // Parse raw log into typed event
  const parseLog = useCallback((log: any): ContractEvent | null => {
    try {
      const { topics, data, blockNumber, transactionHash } = log;
      const blockNum = parseInt(blockNumber, 16);
      const timestamp = Date.now();

      // Transfer event
      if (topics[0]?.toLowerCase() === TRANSFER_EVENT_TOPIC.toLowerCase()) {
        const from = '0x' + topics[1]?.slice(-40).toLowerCase();
        const to = '0x' + topics[2]?.slice(-40).toLowerCase();
        const tokenId = BigInt(topics[3]).toString();

        return {
          type: 'Transfer',
          from,
          to,
          tokenId,
          blockNumber: blockNum,
          transactionHash,
          timestamp,
        };
      }

      // Try to decode other events
      try {
        const decoded = decodeEventLog({
          abi: CONTRACT_EVENTS_V3,
          data,
          topics,
        }) as { eventName: string; args: Record<string, unknown> };

        if (decoded.eventName === 'NFTMinted') {
          const args = decoded.args;
          return {
            type: 'NFTMinted',
            to: String(args.to || ''),
            tokenId: String(args.tokenId || '0'),
            tokenURI: String(args.tokenURI || ''),
            level: Number(args.level || 0),
            rarity: Number(args.rarity || 0),
            pricePaid: BigInt(String(args.pricePaid || 0)),
            currency: Number(args.currency || 0) === 1 ? 'USDC' : 'ETH',
            blockNumber: blockNum,
            transactionHash,
            timestamp,
          };
        }

        if (decoded.eventName === 'BonusClaimed') {
          const args = decoded.args;
          return {
            type: 'BonusClaimed',
            user: String(args.user || ''),
            levelId: Number(args.levelId || 0),
            amount: BigInt(String(args.amount || 0)),
            currency: Number(args.currency || 0) === 1 ? 'USDC' : 'ETH',
            blockNumber: blockNum,
            transactionHash,
            timestamp,
          };
        }
      } catch {
        // Not a decodable event, skip
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  // Fetch logs from a block range
  const fetchLogs = useCallback(async (fromBlock: number, toBlock: number): Promise<ContractEvent[]> => {
    const logs = await rpcCall('eth_getLogs', [{
      address: NFT_CONTRACT_ADDRESS_V3,
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
    }]) as any[];

    if (!Array.isArray(logs)) return [];

    const events: ContractEvent[] = [];
    for (const log of logs) {
      const parsed = parseLog(log);
      if (parsed) {
        // Filter by wallet if provided
        if (walletAddress) {
          const addr = walletAddress.toLowerCase();
          if (
            (parsed.type === 'Transfer' && (parsed.from === addr || parsed.to === addr)) ||
            (parsed.type === 'NFTMinted' && parsed.to.toLowerCase() === addr) ||
            (parsed.type === 'BonusClaimed' && parsed.user.toLowerCase() === addr)
          ) {
            events.push(parsed);
          }
        } else {
          events.push(parsed);
        }
      }
    }

    return events;
  }, [walletAddress, parseLog]);

  // Start polling for new events
  const startListening = useCallback(async () => {
    if (pollingRef.current) return;

    setState(prev => ({ ...prev, isListening: true, error: null }));

    try {
      // Get current block
      const blockHex = await rpcCall('eth_blockNumber', []) as string;
      const currentBlock = parseInt(blockHex, 16);
      lastBlockRef.current = currentBlock;

      // Fetch recent events (last 1000 blocks)
      const fromBlock = Math.max(0, currentBlock - 1000);
      const recentEvents = await fetchLogs(fromBlock, currentBlock);
      
      eventsRef.current = recentEvents;
      setState(prev => ({
        ...prev,
        events: recentEvents,
        lastBlock: currentBlock,
      }));

      // Start polling
      pollingRef.current = window.setInterval(async () => {
        try {
          const newBlockHex = await rpcCall('eth_blockNumber', []) as string;
          const newBlock = parseInt(newBlockHex, 16);

          if (newBlock > lastBlockRef.current) {
            const newEvents = await fetchLogs(lastBlockRef.current + 1, newBlock);
            
            if (newEvents.length > 0) {
              eventsRef.current = [...newEvents, ...eventsRef.current].slice(0, 100);
              setState(prev => ({
                ...prev,
                events: eventsRef.current,
                lastBlock: newBlock,
              }));
            } else {
              setState(prev => ({ ...prev, lastBlock: newBlock }));
            }

            lastBlockRef.current = newBlock;
          }
        } catch (err) {
          console.warn('[ContractEvents] Polling error:', err);
        }
      }, 3000); // Poll every 3 seconds
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start listening';
      setState(prev => ({ ...prev, error: message, isListening: false }));
    }
  }, [fetchLogs]);

  // Stop polling
  const stopListening = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  // Get events for a specific address
  const getEventsForAddress = useCallback((address: string): ContractEvent[] => {
    const addr = address.toLowerCase();
    return eventsRef.current.filter(event => {
      if (event.type === 'Transfer') {
        return event.from === addr || event.to === addr;
      }
      if (event.type === 'NFTMinted') {
        return event.to.toLowerCase() === addr;
      }
      if (event.type === 'BonusClaimed') {
        return event.user.toLowerCase() === addr;
      }
      return false;
    });
  }, []);

  // Get mint events only
  const getMintEvents = useCallback((): (TransferEvent | NFTMintedEvent)[] => {
    return eventsRef.current.filter(
      e => e.type === 'NFTMinted' || (e.type === 'Transfer' && e.from === ZERO_ADDRESS)
    ) as (TransferEvent | NFTMintedEvent)[];
  }, []);

  // Get bonus claim events
  const getBonusClaimEvents = useCallback((): BonusClaimedEvent[] => {
    return eventsRef.current.filter(e => e.type === 'BonusClaimed') as BonusClaimedEvent[];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Auto-start when wallet is provided
  useEffect(() => {
    if (walletAddress) {
      startListening();
    }
    return () => stopListening();
  }, [walletAddress, startListening, stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    getEventsForAddress,
    getMintEvents,
    getBonusClaimEvents,
  };
}
