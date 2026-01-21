/**
 * Sync State Engine - Bidirectional sync between contract and admin panel
 * Based on syncEngine.js from Production Sync System
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Sync modes matching Production Sync System
type SyncMode = "BIDIRECTIONAL" | "ADMIN_TO_CONTRACT" | "CONTRACT_TO_ADMIN" | "MANUAL";

interface SyncConfig {
  mode: SyncMode;
  dryRun: boolean;
  autoSync: boolean;
}

interface Mismatch {
  field: string;
  contractValue: unknown;
  adminValue: unknown;
  severity: "critical" | "warning" | "info";
  suggestedAction: "sync_to_admin" | "sync_to_contract" | "manual_review";
}

interface SyncResult {
  success: boolean;
  mode: SyncMode;
  dryRun: boolean;
  mismatches: Mismatch[];
  actions: string[];
  timestamp: string;
}

// Compare contract state with admin state
function detectMismatches(contractState: Record<string, unknown>, adminState: Record<string, unknown>): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const criticalToggles = ["killSwitch", "isKillSwitchActive", "mintPaused", "isMintActive"];
  const warningToggles = ["freeMintActive", "bonusClaimActive", "bonusLevelsEnabled"];

  // Check toggles
  const contractToggles = contractState.toggles as Record<string, boolean> | undefined;
  const adminToggles = adminState.toggles as Record<string, boolean> | undefined;

  if (contractToggles && adminToggles) {
    for (const [key, contractValue] of Object.entries(contractToggles)) {
      const adminValue = adminToggles[key];
      if (adminValue !== undefined && contractValue !== adminValue) {
        const severity = criticalToggles.includes(key) ? "critical" : 
                        warningToggles.includes(key) ? "warning" : "info";
        mismatches.push({
          field: `toggles.${key}`,
          contractValue,
          adminValue,
          severity,
          suggestedAction: "sync_to_admin",
        });
      }
    }
  }

  // Check pricing
  const contractPricing = contractState.pricing as Record<string, unknown> | undefined;
  const adminPricing = adminState.pricing as Record<string, unknown> | undefined;

  if (contractPricing && adminPricing) {
    for (const [key, contractValue] of Object.entries(contractPricing)) {
      const adminValue = adminPricing[key];
      if (adminValue !== undefined && String(contractValue) !== String(adminValue)) {
        mismatches.push({
          field: `pricing.${key}`,
          contractValue,
          adminValue,
          severity: "warning",
          suggestedAction: "sync_to_admin",
        });
      }
    }
  }

  // Check stats (always sync to admin, contract is source of truth)
  const contractStats = contractState.stats as Record<string, unknown> | undefined;
  const adminStats = adminState.stats as Record<string, unknown> | undefined;

  if (contractStats && adminStats) {
    for (const [key, contractValue] of Object.entries(contractStats)) {
      const adminValue = adminStats[key];
      if (adminValue !== undefined && String(contractValue) !== String(adminValue)) {
        mismatches.push({
          field: `stats.${key}`,
          contractValue,
          adminValue,
          severity: "info",
          suggestedAction: "sync_to_admin",
        });
      }
    }
  }

  // Check bonus pools
  const contractBonusPools = contractState.bonusPools as Record<string, unknown> | undefined;
  const adminBonusPools = adminState.bonusPools as Record<string, unknown> | undefined;

  if (contractBonusPools && adminBonusPools) {
    for (const [key, contractValue] of Object.entries(contractBonusPools)) {
      const adminValue = adminBonusPools[key];
      if (adminValue !== undefined && String(contractValue) !== String(adminValue)) {
        mismatches.push({
          field: `bonusPools.${key}`,
          contractValue,
          adminValue,
          severity: "warning",
          suggestedAction: "sync_to_admin",
        });
      }
    }
  }

  return mismatches;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const config: SyncConfig = {
      mode: body.mode ?? "BIDIRECTIONAL",
      dryRun: body.dryRun ?? false,
      autoSync: body.autoSync ?? true,
    };

    const contractState = body.contractState;
    const adminState = body.adminState ?? {};

    if (!contractState) {
      return new Response(
        JSON.stringify({ success: false, error: "contractState is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect mismatches
    const mismatches = detectMismatches(contractState, adminState);
    const actions: string[] = [];

    // Create audit log entry
    const auditEntry = {
      timestamp: new Date().toISOString(),
      mode: config.mode,
      dryRun: config.dryRun,
      mismatchCount: mismatches.length,
      criticalCount: mismatches.filter(m => m.severity === "critical").length,
      contractState,
      adminState,
    };

    console.log("[sync-state] Audit:", JSON.stringify(auditEntry));

    // In dry run mode, just report mismatches
    if (config.dryRun) {
      actions.push("DRY_RUN: No changes applied");
    } else if (config.autoSync && mismatches.length > 0) {
      // Apply sync based on mode
      switch (config.mode) {
        case "CONTRACT_TO_ADMIN":
          // Contract is source of truth - update admin state
          actions.push(`CONTRACT_TO_ADMIN: Would update ${mismatches.length} fields in admin panel`);
          break;
        case "ADMIN_TO_CONTRACT":
          // Admin is source of truth - would need wallet signing
          actions.push(`ADMIN_TO_CONTRACT: ${mismatches.length} contract writes required (needs wallet)`);
          break;
        case "BIDIRECTIONAL":
          // Smart sync based on timestamps/priority
          const toAdmin = mismatches.filter(m => m.suggestedAction === "sync_to_admin").length;
          const toContract = mismatches.filter(m => m.suggestedAction === "sync_to_contract").length;
          actions.push(`BIDIRECTIONAL: ${toAdmin} to admin, ${toContract} to contract`);
          break;
        case "MANUAL":
          actions.push("MANUAL: Review required for all mismatches");
          break;
      }
    }

    const result: SyncResult = {
      success: true,
      mode: config.mode,
      dryRun: config.dryRun,
      mismatches,
      actions,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[sync-state] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
