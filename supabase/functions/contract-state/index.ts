/**
 * Contract State Reader - Extended state fetching for sync engine
 * Based on contractReader.js from Production Sync System
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeFunctionData, decodeFunctionResult, parseAbi } from "npm:viem@2.41.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

const CONTRACT_ADDRESS = "0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0" as const;

const RPC_ENDPOINTS = [
  "https://mainnet.base.org",
  "https://base.publicnode.com",
  "https://base.gateway.tenderly.co",
  "https://base.llamarpc.com",
  "https://base.drpc.org",
  "https://1rpc.io/base",
  "https://base-mainnet.public.blastapi.io",
  "https://base.meowrpc.com",
];

// Extended ABI for full contract state
const CONTRACT_ABI = parseAbi([
  // Toggles
  "function isMintActive() view returns (bool)",
  "function mintPaused() view returns (bool)",
  "function freeMintActive() view returns (bool)",
  "function isFreeMint() view returns (bool)",
  "function killSwitch() view returns (bool)",
  "function isKillSwitchActive() view returns (bool)",
  "function bonusClaimActive() view returns (bool)",
  "function bonusLevelsEnabled() view returns (bool)",
  "function dynamicPricingEnabled() view returns (bool)",
  "function dynamicBonusEnabled() view returns (bool)",
  "function allowBonusDeposit() view returns (bool)",
  "function withdrawFeesEnabled() view returns (bool)",
  "function ownershipTransferEnabled() view returns (bool)",
  "function throttleEnabled() view returns (bool)",
  // Pricing
  "function mintCurrency() view returns (uint8)",
  "function mintPriceETH() view returns (uint256)",
  "function mintPriceUSDC() view returns (uint256)",
  // Stats
  "function totalMinted() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function owner() view returns (address)",
  // Bonus pools
  "function bonusPoolETH() view returns (uint256)",
  "function bonusPoolUSDC() view returns (uint256)",
  // Level pricing (indexed)
  "function levelPrices(uint8 level) view returns (uint256 priceETH, uint256 priceUSDC, bool active)",
  "function levelBonuses(uint8 level) view returns (uint256 bonusETH, uint256 bonusUSDC, bool active)",
  // Supply tiers (indexed)
  "function supplyPriceTiers(uint8 tier) view returns (uint256 minSupply, uint256 maxSupply, uint256 priceETH, uint256 priceUSDC, bool enabled)",
  "function supplyBonusTiers(uint8 tier) view returns (uint256 minSupply, uint256 maxSupply, uint256 bonusETH, uint256 bonusUSDC, bool enabled)",
]);

const workingEndpoints: string[] = [];

async function robustEthCall(data: `0x${string}`): Promise<`0x${string}`> {
  const errors: string[] = [];
  const orderedEndpoints = [
    ...workingEndpoints.filter(e => RPC_ENDPOINTS.includes(e)),
    ...RPC_ENDPOINTS.filter(e => !workingEndpoints.includes(e))
  ];

  for (const endpoint of orderedEndpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "eth_call",
          params: [{ to: CONTRACT_ADDRESS, data }, "latest"],
        }),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        errors.push(`${endpoint}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      
      if (json?.error?.code === -32016 || json?.error?.message?.includes("rate limit")) {
        errors.push(`${endpoint}: Rate limited`);
        continue;
      }
      
      if (json?.error) {
        errors.push(`${endpoint}: ${json.error?.message ?? "RPC error"}`);
        continue;
      }
      
      const result = json?.result;
      if (typeof result === "string" && result.startsWith("0x")) {
        if (result === "0x") {
          errors.push(`${endpoint}: Empty result`);
          continue;
        }
        if (!workingEndpoints.includes(endpoint)) {
          workingEndpoints.push(endpoint);
        }
        return result as `0x${string}`;
      }
      errors.push(`${endpoint}: Missing result`);
    } catch (e) {
      clearTimeout(timeoutId);
      errors.push(`${endpoint}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }
  throw new Error(`All RPC endpoints failed: ${errors.slice(-5).join("; ")}`);
}

type BoolFnName = "isMintActive" | "mintPaused" | "freeMintActive" | "isFreeMint" | "killSwitch" | "isKillSwitchActive" | "bonusClaimActive" | "bonusLevelsEnabled" | "dynamicPricingEnabled" | "dynamicBonusEnabled" | "allowBonusDeposit" | "withdrawFeesEnabled" | "ownershipTransferEnabled" | "throttleEnabled";
type Uint256FnName = "mintCurrency" | "mintPriceETH" | "mintPriceUSDC" | "totalMinted" | "maxSupply" | "bonusPoolETH" | "bonusPoolUSDC";
type AddressFnName = "owner";

async function readBool(functionName: BoolFnName): Promise<boolean> {
  try {
    const callData = encodeFunctionData({ abi: CONTRACT_ABI, functionName, args: [] });
    const result = await robustEthCall(callData);
    return decodeFunctionResult({ abi: CONTRACT_ABI, functionName, data: result }) as boolean;
  } catch {
    return false;
  }
}

async function readUint256(functionName: Uint256FnName): Promise<string> {
  try {
    const callData = encodeFunctionData({ abi: CONTRACT_ABI, functionName, args: [] });
    const result = await robustEthCall(callData);
    const decoded = decodeFunctionResult({ abi: CONTRACT_ABI, functionName, data: result });
    return String(decoded);
  } catch {
    return "0";
  }
}

async function readAddress(functionName: AddressFnName): Promise<string> {
  try {
    const callData = encodeFunctionData({ abi: CONTRACT_ABI, functionName, args: [] });
    const result = await robustEthCall(callData);
    return decodeFunctionResult({ abi: CONTRACT_ABI, functionName, data: result }) as string;
  } catch {
    return "0x0000000000000000000000000000000000000000";
  }
}

async function readLevelPrice(level: number): Promise<{ priceETH: string; priceUSDC: string; active: boolean }> {
  try {
    const callData = encodeFunctionData({ abi: CONTRACT_ABI, functionName: "levelPrices", args: [level] });
    const result = await robustEthCall(callData);
    const decoded = decodeFunctionResult({ abi: CONTRACT_ABI, functionName: "levelPrices", data: result }) as [bigint, bigint, boolean];
    return { priceETH: String(decoded[0]), priceUSDC: String(decoded[1]), active: decoded[2] };
  } catch {
    return { priceETH: "0", priceUSDC: "0", active: false };
  }
}

async function readLevelBonus(level: number): Promise<{ bonusETH: string; bonusUSDC: string; active: boolean }> {
  try {
    const callData = encodeFunctionData({ abi: CONTRACT_ABI, functionName: "levelBonuses", args: [level] });
    const result = await robustEthCall(callData);
    const decoded = decodeFunctionResult({ abi: CONTRACT_ABI, functionName: "levelBonuses", data: result }) as [bigint, bigint, boolean];
    return { bonusETH: String(decoded[0]), bonusUSDC: String(decoded[1]), active: decoded[2] };
  } catch {
    return { bonusETH: "0", bonusUSDC: "0", active: false };
  }
}

async function readSupplyPriceTier(tier: number): Promise<{ minSupply: string; maxSupply: string; priceETH: string; priceUSDC: string; enabled: boolean }> {
  try {
    const callData = encodeFunctionData({ abi: CONTRACT_ABI, functionName: "supplyPriceTiers", args: [tier] });
    const result = await robustEthCall(callData);
    const decoded = decodeFunctionResult({ abi: CONTRACT_ABI, functionName: "supplyPriceTiers", data: result }) as [bigint, bigint, bigint, bigint, boolean];
    return { 
      minSupply: String(decoded[0]), 
      maxSupply: String(decoded[1]), 
      priceETH: String(decoded[2]), 
      priceUSDC: String(decoded[3]), 
      enabled: decoded[4] 
    };
  } catch {
    return { minSupply: "0", maxSupply: "0", priceETH: "0", priceUSDC: "0", enabled: false };
  }
}

async function readSupplyBonusTier(tier: number): Promise<{ minSupply: string; maxSupply: string; bonusETH: string; bonusUSDC: string; enabled: boolean }> {
  try {
    const callData = encodeFunctionData({ abi: CONTRACT_ABI, functionName: "supplyBonusTiers", args: [tier] });
    const result = await robustEthCall(callData);
    const decoded = decodeFunctionResult({ abi: CONTRACT_ABI, functionName: "supplyBonusTiers", data: result }) as [bigint, bigint, bigint, bigint, boolean];
    return { 
      minSupply: String(decoded[0]), 
      maxSupply: String(decoded[1]), 
      bonusETH: String(decoded[2]), 
      bonusUSDC: String(decoded[3]), 
      enabled: decoded[4] 
    };
  } catch {
    return { minSupply: "0", maxSupply: "0", bonusETH: "0", bonusUSDC: "0", enabled: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    workingEndpoints.length = 0;

    // Parse request for optional level/tier range
    let maxLevels = 20;
    let maxTiers = 5;
    
    if (req.method === "POST") {
      try {
        const body = await req.json();
        maxLevels = body.maxLevels ?? 20;
        maxTiers = body.maxTiers ?? 5;
      } catch {
        // Use defaults
      }
    }

    // Fetch all toggles in parallel
    const [
      isMintActive,
      mintPaused,
      freeMintActive,
      isFreeMint,
      killSwitch,
      isKillSwitchActive,
      bonusClaimActive,
      bonusLevelsEnabled,
      dynamicPricingEnabled,
      dynamicBonusEnabled,
      allowBonusDeposit,
      withdrawFeesEnabled,
      ownershipTransferEnabled,
      throttleEnabled,
      mintCurrency,
      mintPriceETH,
      mintPriceUSDC,
      totalMinted,
      maxSupply,
      owner,
      bonusPoolETH,
      bonusPoolUSDC,
    ] = await Promise.all([
      readBool("isMintActive"),
      readBool("mintPaused"),
      readBool("freeMintActive"),
      readBool("isFreeMint"),
      readBool("killSwitch"),
      readBool("isKillSwitchActive"),
      readBool("bonusClaimActive"),
      readBool("bonusLevelsEnabled"),
      readBool("dynamicPricingEnabled"),
      readBool("dynamicBonusEnabled"),
      readBool("allowBonusDeposit"),
      readBool("withdrawFeesEnabled"),
      readBool("ownershipTransferEnabled"),
      readBool("throttleEnabled"),
      readUint256("mintCurrency"),
      readUint256("mintPriceETH"),
      readUint256("mintPriceUSDC"),
      readUint256("totalMinted"),
      readUint256("maxSupply"),
      readAddress("owner"),
      readUint256("bonusPoolETH"),
      readUint256("bonusPoolUSDC"),
    ]);

    // Fetch level prices and bonuses
    const levelPricesPromises = Array.from({ length: maxLevels }, (_, i) => readLevelPrice(i + 1));
    const levelBonusesPromises = Array.from({ length: maxLevels }, (_, i) => readLevelBonus(i + 1));
    const supplyPriceTiersPromises = Array.from({ length: maxTiers }, (_, i) => readSupplyPriceTier(i));
    const supplyBonusTiersPromises = Array.from({ length: maxTiers }, (_, i) => readSupplyBonusTier(i));

    const [levelPrices, levelBonuses, supplyPriceTiers, supplyBonusTiers] = await Promise.all([
      Promise.all(levelPricesPromises),
      Promise.all(levelBonusesPromises),
      Promise.all(supplyPriceTiersPromises),
      Promise.all(supplyBonusTiersPromises),
    ]);

    const state = {
      // Toggles
      toggles: {
        isMintActive,
        mintPaused,
        freeMintActive,
        isFreeMint,
        killSwitch,
        isKillSwitchActive,
        bonusClaimActive,
        bonusLevelsEnabled,
        dynamicPricingEnabled,
        dynamicBonusEnabled,
        allowBonusDeposit,
        withdrawFeesEnabled,
        ownershipTransferEnabled,
        throttleEnabled,
      },
      // Pricing
      pricing: {
        mintCurrency: Number(mintCurrency),
        mintPriceETH,
        mintPriceUSDC,
      },
      // Stats
      stats: {
        totalMinted,
        maxSupply,
        owner,
      },
      // Bonus pools
      bonusPools: {
        bonusPoolETH,
        bonusPoolUSDC,
      },
      // Dynamic pricing
      levelPrices: levelPrices.reduce((acc, lp, i) => ({ ...acc, [i + 1]: lp }), {}),
      levelBonuses: levelBonuses.reduce((acc, lb, i) => ({ ...acc, [i + 1]: lb }), {}),
      supplyPriceTiers: supplyPriceTiers.reduce((acc, st, i) => ({ ...acc, [i]: st }), {}),
      supplyBonusTiers: supplyBonusTiers.reduce((acc, sb, i) => ({ ...acc, [i]: sb }), {}),
    };

    return new Response(
      JSON.stringify({
        success: true,
        contract: CONTRACT_ADDRESS,
        timestamp: new Date().toISOString(),
        state,
        workingEndpoints,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[contract-state] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        contract: CONTRACT_ADDRESS,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      },
    );
  }
});
