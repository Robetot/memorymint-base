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

// Public Base Mainnet RPCs (no API key)
const RPC_ENDPOINTS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base.meowrpc.com",
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

async function robustEthCall(data: `0x${string}`): Promise<`0x${string}`> {
  const errors: string[] = [];

  for (const endpoint of RPC_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
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
    // allow optional override for debugging multiple contracts
    let address = CONTRACT_ADDRESS;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.address === "string" && body.address.startsWith("0x") && body.address.length === 42) {
          address = body.address as typeof CONTRACT_ADDRESS;
        }
      } catch {
        // ignore
      }
    }

    // NOTE: this function is intended for the MemoryMint production contract.
    // If address override is used, the ABI must still match.
    if (address !== CONTRACT_ADDRESS) {
      return new Response(
        JSON.stringify({
          error:
            "This endpoint is pinned to the MemoryMint production ABI; address override is disabled for safety.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
        contract: CONTRACT_ADDRESS,
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
          "mintingAllowed is computed as isMintActive && !isKillSwitchActive",
          "msgValueZeroShouldWorkForEthPath applies to mintNFT/mintGameNFT (ETH payable functions)",
        ],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
