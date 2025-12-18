import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 1000

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

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

// Upload file to Pinata IPFS
async function uploadToPinata(
  content: Uint8Array | string, 
  filename: string, 
  contentType: string,
  pinataJwt: string
): Promise<string> {
  const formData = new FormData()
  
  let blob: Blob
  if (typeof content === 'string') {
    blob = new Blob([content], { type: contentType })
  } else {
    // Convert Uint8Array to regular array for Blob compatibility
    blob = new Blob([new Uint8Array(content)], { type: contentType })
  }
  
  formData.append('file', blob, filename)
  
  // Add pinata metadata
  const pinataMetadata = JSON.stringify({
    name: filename,
    keyvalues: {
      app: 'MemoryMint',
      timestamp: new Date().toISOString()
    }
  })
  formData.append('pinataMetadata', pinataMetadata)

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pinataJwt}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Pinata upload failed:', response.status, errorText)
    throw new Error(`Pinata upload failed: ${response.status}`)
  }

  const result = await response.json()
  return result.IpfsHash
}

// Convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove data URI prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// Detect image type from base64 data URI
function getImageType(dataUri: string): string {
  if (dataUri.includes('image/png')) return 'png'
  if (dataUri.includes('image/jpeg') || dataUri.includes('image/jpg')) return 'jpg'
  if (dataUri.includes('image/gif')) return 'gif'
  if (dataUri.includes('image/webp')) return 'webp'
  return 'png' // default
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown'
    
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

    // Get Pinata JWT
    const pinataJwt = Deno.env.get('PINATA_JWT')
    if (!pinataJwt) {
      console.error('PINATA_JWT not configured')
      return new Response(
        JSON.stringify({ error: 'IPFS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    if (imageData.length > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Image data exceeds maximum size limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize metadata
    const sanitizedName = typeof metadata.name === 'string' 
      ? metadata.name.slice(0, 100).replace(/[\x00-\x1F\x7F-\x9F]/g, '') 
      : 'MemoryMint NFT'
    
    const sanitizedDescription = typeof metadata.description === 'string'
      ? metadata.description.slice(0, 500).replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      : 'A skill-based NFT from MemoryMint'

    let sanitizedAttributes: Array<{ trait_type: string; value: string | number }> = []
    if (Array.isArray(metadata.attributes)) {
      sanitizedAttributes = metadata.attributes
        .slice(0, 20)
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

    console.log(`Uploading to IPFS via Pinata for IP ${clientIp}`)

    // Step 1: Upload image to IPFS
    const imageType = getImageType(imageData)
    const imageBytes = base64ToUint8Array(imageData)
    const timestamp = Date.now()
    const imageFilename = `memorymint-${timestamp}.${imageType}`
    
    console.log(`Uploading image: ${imageFilename} (${imageBytes.length} bytes)`)
    const imageCid = await uploadToPinata(
      imageBytes, 
      imageFilename, 
      `image/${imageType}`,
      pinataJwt
    )
    console.log(`Image uploaded to IPFS: ${imageCid}`)

    // Step 2: Create metadata JSON with IPFS image URL
    const nftMetadata = {
      name: sanitizedName,
      description: sanitizedDescription,
      image: `ipfs://${imageCid}`,
      external_url: 'https://memorymint.app',
      attributes: sanitizedAttributes,
    }

    // Step 3: Upload metadata JSON to IPFS
    const metadataJson = JSON.stringify(nftMetadata, null, 2)
    const metadataFilename = `memorymint-metadata-${timestamp}.json`
    
    console.log(`Uploading metadata: ${metadataFilename}`)
    const metadataCid = await uploadToPinata(
      metadataJson,
      metadataFilename,
      'application/json',
      pinataJwt
    )
    console.log(`Metadata uploaded to IPFS: ${metadataCid}`)

    // Return the metadata CID as tokenURI
    const tokenURI = `ipfs://${metadataCid}`

    return new Response(
      JSON.stringify({ 
        success: true,
        cid: metadataCid,
        tokenURI,
        imageCid,
        imageUrl: `ipfs://${imageCid}`,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${metadataCid}`,
        imageGatewayUrl: `https://gateway.pinata.cloud/ipfs/${imageCid}`,
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
    const message = error instanceof Error ? error.message : 'Upload failed'
    return new Response(
      JSON.stringify({ error: `Failed to upload to IPFS: ${message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
