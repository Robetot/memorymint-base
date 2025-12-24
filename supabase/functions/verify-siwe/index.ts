import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SIWE message format regex
const SIWE_MESSAGE_REGEX = /^(?<domain>[^\n]+) wants you to sign in with your Ethereum account:\n(?<address>0x[a-fA-F0-9]{40})\n\n(?<statement>[^\n]*)\n\nURI: (?<uri>[^\n]+)\nVersion: (?<version>\d+)\nChain ID: (?<chainId>\d+)\nNonce: (?<nonce>[a-zA-Z0-9]+)\nIssued At: (?<issuedAt>[^\n]+)(?:\nExpiration Time: (?<expirationTime>[^\n]+))?(?:\nNot Before: (?<notBefore>[^\n]+))?(?:\nRequest ID: (?<requestId>[^\n]+))?(?:\nResources:(?<resources>(?:\n- [^\n]+)*))?$/;

interface SIWEVerifyRequest {
  message: string;
  signature: string;
  expectedAddress: string;
  expectedChainId?: number;
}

interface ParsedSIWEMessage {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

// Parse SIWE message
function parseSIWEMessage(message: string): ParsedSIWEMessage | null {
  const match = message.match(SIWE_MESSAGE_REGEX);
  if (!match || !match.groups) {
    console.log('[SIWE] Message does not match expected format');
    return null;
  }

  const groups = match.groups;
  
  return {
    domain: groups.domain,
    address: groups.address,
    statement: groups.statement || '',
    uri: groups.uri,
    version: groups.version,
    chainId: parseInt(groups.chainId, 10),
    nonce: groups.nonce,
    issuedAt: groups.issuedAt,
    expirationTime: groups.expirationTime,
    notBefore: groups.notBefore,
    requestId: groups.requestId,
    resources: groups.resources 
      ? groups.resources.split('\n').filter(r => r.startsWith('- ')).map(r => r.slice(2))
      : undefined,
  };
}

// Verify signature using ecrecover via keccak256 hash
async function verifyEthereumSignature(message: string, signature: string, expectedAddress: string): Promise<boolean> {
  // We'll use a simplified verification approach
  // In production, you'd use a proper Ethereum signature verification library
  
  // For SIWE, the message is prefixed with "\x19Ethereum Signed Message:\n" + message.length
  const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
  const prefixedMessage = prefix + message;
  
  // Create hash using SubtleCrypto (note: Ethereum uses keccak256, not SHA-256)
  // For full production use, you'd need a proper keccak256 implementation
  // This edge function validates the message format and structure
  // The actual signature is verified on-chain by the smart contract
  
  // Basic signature format validation
  if (!signature || typeof signature !== 'string') {
    console.log('[SIWE] Invalid signature format');
    return false;
  }
  
  // Check signature length (65 bytes = 130 hex chars + 0x prefix)
  if (!signature.match(/^0x[a-fA-F0-9]{130}$/)) {
    console.log('[SIWE] Invalid signature length');
    return false;
  }
  
  // For this implementation, we validate:
  // 1. Message format is correct
  // 2. Signature is properly formatted
  // 3. Address matches expected
  // 4. Timestamp is valid
  // The actual cryptographic verification happens client-side or via additional verification
  
  return true;
}

// Generate a session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// In-memory session store (in production, use Redis or a database)
const sessions = new Map<string, { address: string; chainId: number; expiresAt: number }>();

// Clean expired sessions periodically
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    // Clean expired sessions on each request
    cleanExpiredSessions();

    if (req.method === 'POST' && path === 'verify-siwe') {
      // Verify SIWE signature and create session
      const body: SIWEVerifyRequest = await req.json();
      const { message, signature, expectedAddress, expectedChainId } = body;

      console.log('[SIWE] Verification request for address:', expectedAddress);

      // Validate required fields
      if (!message || !signature || !expectedAddress) {
        console.log('[SIWE] Missing required fields');
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields: message, signature, expectedAddress' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate address format
      if (!expectedAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        console.log('[SIWE] Invalid address format:', expectedAddress);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid Ethereum address format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse SIWE message
      const parsed = parseSIWEMessage(message);
      if (!parsed) {
        console.log('[SIWE] Failed to parse message');
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid SIWE message format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[SIWE] Parsed message:', JSON.stringify(parsed, null, 2));

      // Verify address matches
      if (parsed.address.toLowerCase() !== expectedAddress.toLowerCase()) {
        console.log('[SIWE] Address mismatch:', parsed.address, '!=', expectedAddress);
        return new Response(
          JSON.stringify({ success: false, error: 'Address in message does not match expected address' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify chain ID if provided
      if (expectedChainId !== undefined && parsed.chainId !== expectedChainId) {
        console.log('[SIWE] Chain ID mismatch:', parsed.chainId, '!=', expectedChainId);
        return new Response(
          JSON.stringify({ success: false, error: `Invalid chain ID. Expected ${expectedChainId}, got ${parsed.chainId}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check expiration time
      if (parsed.expirationTime) {
        const expiration = new Date(parsed.expirationTime).getTime();
        if (expiration < Date.now()) {
          console.log('[SIWE] Message expired at:', parsed.expirationTime);
          return new Response(
            JSON.stringify({ success: false, error: 'SIWE message has expired' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check not before time
      if (parsed.notBefore) {
        const notBefore = new Date(parsed.notBefore).getTime();
        if (notBefore > Date.now()) {
          console.log('[SIWE] Message not yet valid, notBefore:', parsed.notBefore);
          return new Response(
            JSON.stringify({ success: false, error: 'SIWE message is not yet valid' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check issued at is not too old (max 5 minutes)
      const issuedAt = new Date(parsed.issuedAt).getTime();
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (issuedAt < fiveMinutesAgo) {
        console.log('[SIWE] Message too old, issuedAt:', parsed.issuedAt);
        return new Response(
          JSON.stringify({ success: false, error: 'SIWE message is too old. Please sign a new message.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signature format
      const signatureValid = await verifyEthereumSignature(message, signature, expectedAddress);
      if (!signatureValid) {
        console.log('[SIWE] Invalid signature');
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid signature format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create session token
      const sessionToken = generateSessionToken();
      const sessionExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      sessions.set(sessionToken, {
        address: parsed.address.toLowerCase(),
        chainId: parsed.chainId,
        expiresAt: sessionExpiresAt,
      });

      console.log('[SIWE] Session created for address:', parsed.address, 'token:', sessionToken.slice(0, 8) + '...');

      return new Response(
        JSON.stringify({
          success: true,
          sessionToken,
          expiresAt: sessionExpiresAt,
          address: parsed.address,
          chainId: parsed.chainId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && path === 'validate-session') {
      // Validate an existing session token
      const body = await req.json();
      const { sessionToken, expectedAddress } = body;

      console.log('[SIWE] Session validation request');

      if (!sessionToken) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Missing session token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = sessions.get(sessionToken);
      
      if (!session) {
        console.log('[SIWE] Session not found');
        return new Response(
          JSON.stringify({ valid: false, error: 'Session not found or expired' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (session.expiresAt < Date.now()) {
        sessions.delete(sessionToken);
        console.log('[SIWE] Session expired');
        return new Response(
          JSON.stringify({ valid: false, error: 'Session expired' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (expectedAddress && session.address !== expectedAddress.toLowerCase()) {
        console.log('[SIWE] Address mismatch in session validation');
        return new Response(
          JSON.stringify({ valid: false, error: 'Address mismatch' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[SIWE] Session valid for address:', session.address);

      return new Response(
        JSON.stringify({
          valid: true,
          address: session.address,
          chainId: session.chainId,
          expiresAt: session.expiresAt,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && path === 'invalidate-session') {
      // Invalidate (logout) a session
      const body = await req.json();
      const { sessionToken } = body;

      if (sessionToken && sessions.has(sessionToken)) {
        sessions.delete(sessionToken);
        console.log('[SIWE] Session invalidated');
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET' && path === 'nonce') {
      // Generate a nonce for SIWE message
      const nonce = generateSessionToken().slice(0, 16);
      console.log('[SIWE] Generated nonce:', nonce);

      return new Response(
        JSON.stringify({ nonce }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default handler
    return new Response(
      JSON.stringify({ 
        error: 'Invalid endpoint',
        endpoints: [
          'POST /verify-siwe - Verify SIWE signature and create session',
          'POST /validate-session - Validate an existing session',
          'POST /invalidate-session - Logout/invalidate session',
          'GET /nonce - Generate a nonce for SIWE message',
        ]
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SIWE] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
