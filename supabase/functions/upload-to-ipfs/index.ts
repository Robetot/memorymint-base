import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory rate limiting (per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 5 // Max requests per window (stricter for IPFS uploads)
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute window

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(clientIp)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }
  
  record.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count }
}

// Max image data size (5MB base64 encoded)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown'
    
    // Check rate limit
    const { allowed, remaining } = checkRateLimit(clientIp)
    if (!allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`)
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60'
          } 
        }
      )
    }

    const body = await req.json()
    const { imageData, metadata } = body

    // Validate required fields
    if (!imageData || typeof imageData !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Image data is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!metadata || typeof metadata !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Metadata is required and must be an object' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate image data size
    if (imageData.length > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Image data exceeds maximum size limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate image data format (must be base64 or data URI)
    const isValidImageFormat = imageData.startsWith('data:image/') || 
                               /^[A-Za-z0-9+/=]+$/.test(imageData.replace(/\s/g, ''))
    if (!isValidImageFormat) {
      return new Response(
        JSON.stringify({ error: 'Invalid image data format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize metadata fields
    const sanitizedName = typeof metadata.name === 'string' 
      ? metadata.name.slice(0, 100).replace(/[\x00-\x1F\x7F-\x9F]/g, '') 
      : 'MemoryMint NFT'
    
    const sanitizedDescription = typeof metadata.description === 'string'
      ? metadata.description.slice(0, 500).replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      : 'A skill-based NFT from MemoryMint'

    // Validate attributes array if present
    let sanitizedAttributes: Array<{ trait_type: string; value: string | number }> = []
    if (Array.isArray(metadata.attributes)) {
      sanitizedAttributes = metadata.attributes
        .slice(0, 20) // Max 20 attributes
        .filter((attr: unknown) => 
          typeof attr === 'object' && 
          attr !== null && 
          'trait_type' in attr && 
          'value' in attr
        )
        .map((attr: { trait_type: unknown; value: unknown }) => ({
          trait_type: String(attr.trait_type).slice(0, 50),
          value: typeof attr.value === 'number' ? attr.value : String(attr.value).slice(0, 100)
        }))
    }

    console.log(`Uploading to IPFS for IP ${clientIp}, remaining: ${remaining}`)

    // Convert base64 image to proper format for metadata
    const imageBase64 = imageData.startsWith('data:') 
      ? imageData 
      : `data:image/png;base64,${imageData}`

    // Create the metadata object with sanitized data
    const nftMetadata = {
      name: sanitizedName,
      description: sanitizedDescription,
      image: imageBase64,
      attributes: sanitizedAttributes,
      external_url: 'https://memorymint.app',
      created_at: new Date().toISOString(),
    }

    // Create a deterministic hash for the content
    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify(nftMetadata))
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    // Create a pseudo-IPFS CID (in production, use actual IPFS)
    const cid = `bafkrei${hashHex.slice(0, 52)}`
    
    // For demo, we'll use a data URI as the token URI
    // In production, this would be ipfs://[CID]
    const metadataJson = JSON.stringify(nftMetadata)
    const metadataBase64 = btoa(unescape(encodeURIComponent(metadataJson)))
    const tokenURI = `data:application/json;base64,${metadataBase64}`

    console.log('Metadata created with pseudo-CID:', cid)

    return new Response(
      JSON.stringify({ 
        success: true,
        cid,
        tokenURI,
        ipfsUrl: `ipfs://${cid}`,
        gatewayUrl: `https://ipfs.io/ipfs/${cid}`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(remaining)
        } 
      }
    )
  } catch (error: unknown) {
    console.error('Error uploading to IPFS:', error)
    // Don't expose internal error details to client
    return new Response(
      JSON.stringify({ error: 'Failed to upload to IPFS. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
