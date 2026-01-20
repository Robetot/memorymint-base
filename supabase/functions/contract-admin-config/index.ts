import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeFunctionData, decodeFunctionResult, parseAbi } from "npm:viem@2.41.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

const CONTRACT_ADDRESS = "0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0" as const;

// Expanded list of reliable public Base Mainnet RPCs
// Ordered by reliability - prioritize paid/reliable endpoints
const RPC_ENDPOINTS = [
  "https://base.llamarpc.com",           // LlamaNodes - high reliability
  "https://base-mainnet.public.blastapi.io", // BlastAPI
  "https://1rpc.io/base",                // 1RPC
  "https://base.meowrpc.com",            // MeowRPC
  "https://base.drpc.org",               // DRPC
  "https://base-pokt.nodies.app",        // Nodies
  "https://mainnet.base.org",            // Official (often rate-limited)
];

const READ_ABI = parseAbi([
  "function isMintActive() view returns (bool)",
  "function mintPaused() view returns (bool)",
  "function freeMintActive() view returns (bool)",
  "function isFreeMint() view returns (bool)",
  "function mintCurrency() view returns (uint8)",
  "function killSwitch() view returns (bool)",
  "function isKillSwitchActive() view returns (bool)",
]);

type BoolFnName =
  | "isMintActive"
  | "mintPaused"
  | "freeMintActive"
  | "isFreeMint"
  | "killSwitch"
  | "isKillSwitchActive";

// Track which endpoints work for this request
const workingEndpoints: string[] = [];

async function robustEthCall(data: `0x${string}`): Promise<`0x${string}`> {
  const errors: string[] = [];

  // Try working endpoints first (from previous successful calls in this request)
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
      
      // Handle rate limiting specifically
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
        // Some RPCs return "0x" for failed/empty calls; our view functions must return 32 bytes.
        if (result === "0x" || result.length < 66) {
          errors.push(`${endpoint}: Empty/short result (${result.length} chars)`);
          continue;
        }
        // Mark this endpoint as working
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

async function readBool(fn: BoolFnName): Promise<boolean> {
  const callData = encodeFunctionData({ abi: READ_ABI, functionName: fn, args: [] });
  const result = await robustEthCall(callData);
  return decodeFunctionResult({ abi: READ_ABI, functionName: fn, data: result }) as boolean;
}

async function readMintCurrency(): Promise<number> {
  const callData = encodeFunctionData({
    abi: READ_ABI,
    functionName: "mintCurrency",
    args: [],
  });
  const result = await robustEthCall(callData);
  const decoded = decodeFunctionResult({
    abi: READ_ABI,
    functionName: "mintCurrency",
    data: result,
  });
  return Number(decoded);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Clear working endpoints for fresh request
    workingEndpoints.length = 0;

    const [
      isMintActive,
      mintPaused,
      freeMintActive,
      isFreeMint,
      mintCurrency,
      killSwitch,
      isKillSwitchActive,
    ] = await Promise.all([
      readBool("isMintActive"),
      readBool("mintPaused"),
      readBool("freeMintActive"),
      readBool("isFreeMint"),
      readMintCurrency(),
      readBool("killSwitch"),
      readBool("isKillSwitchActive"),
    ]);

    const mintCurrencyLabel = mintCurrency === 1 ? "USDC" : "ETH";
    const mintingAllowed = isMintActive && !isKillSwitchActive;

    // For ETH-path functions (mintNFT / mintGameNFT), msg.value=0 is only valid when isFreeMint() is true.
    // If mintCurrency is USDC, the correct path is mintWithUSDC (msg.value stays 0).
    const msgValueZeroShouldWorkForEthPath = isFreeMint === true;

    return new Response(
      JSON.stringify({
        success: true,
        contract: CONTRACT_ADDRESS,
        timestamp: new Date().toISOString(),
        reads: {
          isMintActive,
          mintPaused,
          freeMintActive,
          isFreeMint,
          mintCurrency,
          killSwitch,
          isKillSwitchActive,
        },
        derived: {
          mintCurrencyLabel,
          mintingAllowed,
          msgValueZeroShouldWorkForEthPath,
        },
        notes: [
          "mintingAllowed = isMintActive && !isKillSwitchActive",
          "msgValueZeroShouldWorkForEthPath applies to mintNFT/mintGameNFT (ETH payable functions)",
          `Working RPC endpoints: ${workingEndpoints.join(", ")}`,
        ],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[contract-admin-config] Error:", err);
    // FAIL-OPEN: Return permissive defaults so frontend doesn't block minting
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        // Provide permissive defaults - contract will enforce real state
        contract: CONTRACT_ADDRESS,
        reads: {
          isMintActive: true,
          mintPaused: false,
          freeMintActive: true,
          isFreeMint: true,
          mintCurrency: 0,
          killSwitch: false,
          isKillSwitchActive: false,
        },
        derived: {
          mintCurrencyLabel: "ETH",
          mintingAllowed: true,
          msgValueZeroShouldWorkForEthPath: true,
        },
        notes: [
          "RPC fetch failed - returning permissive defaults",
          "Contract will enforce actual state on-chain",
        ],
      }),
      { 
        status: 200, // Return 200 even on RPC failure for fail-open behavior
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      },
    );
  }
});
