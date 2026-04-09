/**
 * Admin API - RESTful endpoints for admin panel sync
 * Based on adminPanelAPI.js from Production Sync System
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
};


interface AdminState {
  toggles: Record<string, boolean>;
  pricing: Record<string, string | number>;
  stats: Record<string, string | number>;
  bonusPools: Record<string, string>;
  levelPrices: Record<number, { priceETH: string; priceUSDC: string; active: boolean }>;
  levelBonuses: Record<number, { bonusETH: string; bonusUSDC: string; active: boolean }>;
  supplyPriceTiers: Record<number, { minSupply: string; maxSupply: string; priceETH: string; priceUSDC: string; enabled: boolean }>;
  supplyBonusTiers: Record<number, { minSupply: string; maxSupply: string; bonusETH: string; bonusUSDC: string; enabled: boolean }>;
  updatedAt: string;
}

// In-memory cache for admin state (in production, use database)
let adminStateCache: AdminState | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

function getDefaultState(): AdminState {
  return {
    toggles: {
      isMintActive: true,
      mintPaused: false,
      freeMintActive: true,
      isFreeMint: true,
      killSwitch: false,
      isKillSwitchActive: false,
      bonusClaimActive: true,
      bonusLevelsEnabled: true,
      dynamicPricingEnabled: false,
      dynamicBonusEnabled: false,
      allowBonusDeposit: true,
      withdrawFeesEnabled: true,
      ownershipTransferEnabled: false,
      throttleEnabled: false,
    },
    pricing: {
      mintCurrency: 0,
      mintPriceETH: "0",
      mintPriceUSDC: "0",
    },
    stats: {
      totalMinted: "0",
      maxSupply: "10000",
      owner: "0x0000000000000000000000000000000000000000",
    },
    bonusPools: {
      bonusPoolETH: "0",
      bonusPoolUSDC: "0",
    },
    levelPrices: {},
    levelBonuses: {},
    supplyPriceTiers: {},
    supplyBonusTiers: {},
    updatedAt: new Date().toISOString(),
  };
}

async function verifyAdminAccess(req: Request): Promise<{ authorized: boolean; wallet?: string; error?: string }> {
  // Wallet-based auth via authorization header (JWT from Supabase Auth)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { authorized: false, error: "Missing authorization" };
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return { authorized: false, error: "Invalid token" };
    }

    // Check admin_roles table
    const { data: roles, error: rolesError } = await supabase
      .rpc("wallet_is_admin", { _wallet: data.user.id });

    if (rolesError || !roles) {
      return { authorized: false, error: "Not an admin" };
    }

    return { authorized: true, wallet: data.user.id };
  } catch {
    return { authorized: false, error: "Auth check failed" };
  }
}

function parseRoute(url: URL): { resource: string; id?: string } {
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Expected: /admin-api/resource or /admin-api/resource/id
  const resource = pathParts[1] ?? "state";
  const id = pathParts[2];
  return { resource, id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const { resource, id } = parseRoute(url);

  try {
    // GET /state - Public read access for frontend
    if (req.method === "GET" && resource === "state") {
      const now = Date.now();
      if (adminStateCache && (now - lastCacheUpdate) < CACHE_TTL_MS) {
        return new Response(
          JSON.stringify({ success: true, state: adminStateCache, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return default state or fetch from database
      const state = adminStateCache ?? getDefaultState();
      
      return new Response(
        JSON.stringify({ success: true, state, cached: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /health - Health check
    if (req.method === "GET" && resource === "health") {
      return new Response(
        JSON.stringify({
          healthy: true,
          timestamp: new Date().toISOString(),
          cacheAge: adminStateCache ? Date.now() - lastCacheUpdate : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All other endpoints require admin auth
    const authResult = await verifyAdminAccess(req);
    if (!authResult.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = req.method !== "GET" ? await req.json() : null;

    // POST /toggles - Update a toggle
    if (req.method === "POST" && resource === "toggles") {
      if (!adminStateCache) adminStateCache = getDefaultState();
      
      const { name, value } = body;
      if (typeof name !== "string" || typeof value !== "boolean") {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid toggle data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      adminStateCache.toggles[name] = value;
      adminStateCache.updatedAt = new Date().toISOString();
      lastCacheUpdate = Date.now();

      return new Response(
        JSON.stringify({ success: true, toggle: { name, value } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /level-prices - Update level price
    if (req.method === "POST" && resource === "level-prices") {
      if (!adminStateCache) adminStateCache = getDefaultState();

      const { level, priceETH, priceUSDC, active } = body;
      if (typeof level !== "number") {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid level data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      adminStateCache.levelPrices[level] = { 
        priceETH: String(priceETH ?? "0"), 
        priceUSDC: String(priceUSDC ?? "0"), 
        active: Boolean(active) 
      };
      adminStateCache.updatedAt = new Date().toISOString();
      lastCacheUpdate = Date.now();

      return new Response(
        JSON.stringify({ success: true, levelPrice: { level, ...adminStateCache.levelPrices[level] } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /level-bonuses - Update level bonus
    if (req.method === "POST" && resource === "level-bonuses") {
      if (!adminStateCache) adminStateCache = getDefaultState();

      const { level, bonusETH, bonusUSDC, active } = body;
      if (typeof level !== "number") {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid level data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      adminStateCache.levelBonuses[level] = { 
        bonusETH: String(bonusETH ?? "0"), 
        bonusUSDC: String(bonusUSDC ?? "0"), 
        active: Boolean(active) 
      };
      adminStateCache.updatedAt = new Date().toISOString();
      lastCacheUpdate = Date.now();

      return new Response(
        JSON.stringify({ success: true, levelBonus: { level, ...adminStateCache.levelBonuses[level] } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /supply-price-tiers - Update supply price tier
    if (req.method === "POST" && resource === "supply-price-tiers") {
      if (!adminStateCache) adminStateCache = getDefaultState();

      const { tier, minSupply, maxSupply, priceETH, priceUSDC, enabled } = body;
      if (typeof tier !== "number") {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid tier data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      adminStateCache.supplyPriceTiers[tier] = { 
        minSupply: String(minSupply ?? "0"),
        maxSupply: String(maxSupply ?? "0"),
        priceETH: String(priceETH ?? "0"), 
        priceUSDC: String(priceUSDC ?? "0"), 
        enabled: Boolean(enabled) 
      };
      adminStateCache.updatedAt = new Date().toISOString();
      lastCacheUpdate = Date.now();

      return new Response(
        JSON.stringify({ success: true, supplyPriceTier: { tier, ...adminStateCache.supplyPriceTiers[tier] } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /supply-bonus-tiers - Update supply bonus tier
    if (req.method === "POST" && resource === "supply-bonus-tiers") {
      if (!adminStateCache) adminStateCache = getDefaultState();

      const { tier, minSupply, maxSupply, bonusETH, bonusUSDC, enabled } = body;
      if (typeof tier !== "number") {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid tier data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      adminStateCache.supplyBonusTiers[tier] = { 
        minSupply: String(minSupply ?? "0"),
        maxSupply: String(maxSupply ?? "0"),
        bonusETH: String(bonusETH ?? "0"), 
        bonusUSDC: String(bonusUSDC ?? "0"), 
        enabled: Boolean(enabled) 
      };
      adminStateCache.updatedAt = new Date().toISOString();
      lastCacheUpdate = Date.now();

      return new Response(
        JSON.stringify({ success: true, supplyBonusTier: { tier, ...adminStateCache.supplyBonusTiers[tier] } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /bonus-pools - Update bonus pool balances
    if (req.method === "POST" && resource === "bonus-pools") {
      if (!adminStateCache) adminStateCache = getDefaultState();

      const { bonusPoolETH, bonusPoolUSDC } = body;
      if (bonusPoolETH !== undefined) {
        adminStateCache.bonusPools.bonusPoolETH = String(bonusPoolETH);
      }
      if (bonusPoolUSDC !== undefined) {
        adminStateCache.bonusPools.bonusPoolUSDC = String(bonusPoolUSDC);
      }
      adminStateCache.updatedAt = new Date().toISOString();
      lastCacheUpdate = Date.now();

      return new Response(
        JSON.stringify({ success: true, bonusPools: adminStateCache.bonusPools }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /sync-from-contract - Bulk update from contract state
    if (req.method === "POST" && resource === "sync-from-contract") {
      const { state } = body;
      if (!state) {
        return new Response(
          JSON.stringify({ success: false, error: "state is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      adminStateCache = {
        toggles: state.toggles ?? getDefaultState().toggles,
        pricing: state.pricing ?? getDefaultState().pricing,
        stats: state.stats ?? getDefaultState().stats,
        bonusPools: state.bonusPools ?? getDefaultState().bonusPools,
        levelPrices: state.levelPrices ?? {},
        levelBonuses: state.levelBonuses ?? {},
        supplyPriceTiers: state.supplyPriceTiers ?? {},
        supplyBonusTiers: state.supplyBonusTiers ?? {},
        updatedAt: new Date().toISOString(),
      };
      lastCacheUpdate = Date.now();

      return new Response(
        JSON.stringify({ success: true, state: adminStateCache }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /cache/clear - Clear cache
    if (req.method === "POST" && resource === "cache" && id === "clear") {
      adminStateCache = null;
      lastCacheUpdate = 0;

      return new Response(
        JSON.stringify({ success: true, message: "Cache cleared" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resource not found
    return new Response(
      JSON.stringify({ success: false, error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[admin-api] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
