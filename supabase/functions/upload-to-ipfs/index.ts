import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Max-Age': '86400',
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 10 // Increased from 5
const RATE_LIMIT_WINDOW_MS = 60 * 1000

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  const record = rateLimitMap.get(clientIp)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }
  
  record.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count }
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

// Provider configurations for multi-provider failover
interface UploadProvider {
  name: string;
  upload: (content: Uint8Array | string, filename: string, contentType: string, jwt?: string) => Promise<string>;
}

// Upload file to Pinata IPFS (Primary)
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
    blob = new Blob([new Uint8Array(content)], { type: contentType })
  }
  
  formData.append('file', blob, filename)
  
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
    
    // Detect rate limiting
    if (response.status === 429) {
      throw new Error('RATE_LIMITED:Pinata rate limit exceeded')
    }
    throw new Error(`Pinata upload failed: ${response.status}`)
  }

  const result = await response.json()
  return result.IpfsHash
}

// Convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
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

// Validate metadata structure
function validateMetadata(metadata: unknown): { valid: boolean; error?: string } {
  if (!metadata || typeof metadata !== 'object') {
    return { valid: false, error: 'Metadata must be an object' }
  }
  
  const m = metadata as Record<string, unknown>
  
  if (m.name && typeof m.name !== 'string') {
    return { valid: false, error: 'Metadata name must be a string' }
  }
  
  if (m.attributes && !Array.isArray(m.attributes)) {
    return { valid: false, error: 'Metadata attributes must be an array' }
  }
  
  return { valid: true }
}

// Always return HTTP 200 response with structured data
function successResponse(data: Record<string, unknown>, remaining: number) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { 
      status: 200, // Always 200
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(remaining)
      } 
    }
  )
}

// Fail-open error response - still HTTP 200 but with success: false
function failResponse(reason: string, code: string, remaining: number, fallbackData?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: reason,
      errorCode: code,
      fallback: true,
      ...fallbackData
    }),
    { 
      status: 200, // Always 200 for fail-open
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(remaining),
        'X-Error-Code': code
      } 
    }
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('cf-connecting-ip') || 
                   'unknown'
  
  const { allowed, remaining, retryAfter } = checkRateLimit(clientIp)
  
  // Rate limit - still return 200 but with error info
  if (!allowed) {
    console.log(`Rate limit exceeded for IP: ${clientIp}`)
    return failResponse(
      'Rate limit exceeded. Please try again later.',
      'RATE_LIMITED',
      0,
      { retryAfter }
    )
  }

  try {
    // Get Pinata JWT
    const pinataJwt = Deno.env.get('PINATA_JWT')
    if (!pinataJwt) {
      console.error('PINATA_JWT not configured')
      return failResponse(
        'IPFS service not configured',
        'CONFIG_ERROR',
        remaining
      )
    }

    const body = await req.json()
    const { imageData, metadata } = body

    // Validate required fields
    if (!imageData || typeof imageData !== 'string') {
      return failResponse(
        'Image data is required and must be a string',
        'INVALID_INPUT',
        remaining
      )
    }

    // Validate metadata
    const metadataValidation = validateMetadata(metadata)
    if (!metadataValidation.valid) {
      return failResponse(
        metadataValidation.error || 'Invalid metadata',
        'INVALID_METADATA',
        remaining
      )
    }

    if (imageData.length > MAX_IMAGE_SIZE) {
      return failResponse(
        'Image data exceeds maximum size limit',
        'SIZE_EXCEEDED',
        remaining
      )
    }

    // Sanitize metadata
    const m = metadata as Record<string, unknown>
    const sanitizedName = typeof m.name === 'string' 
      ? m.name.slice(0, 100).replace(/[\x00-\x1F\x7F-\x9F]/g, '') 
      : 'MemoryMint NFT'
    
    const sanitizedDescription = typeof m.description === 'string'
      ? m.description.slice(0, 500).replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      : 'A skill-based NFT from MemoryMint'

    let sanitizedAttributes: Array<{ trait_type: string; value: string | number }> = []
    if (Array.isArray(m.attributes)) {
      sanitizedAttributes = m.attributes
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

    console.log(`[upload-to-ipfs] Starting upload for IP ${clientIp}`)

    // Step 1: Upload image to IPFS with retry
    const imageType = getImageType(imageData)
    const imageBytes = base64ToUint8Array(imageData)
    const timestamp = Date.now()
    const imageFilename = `memorymint-${timestamp}.${imageType}`
    
    console.log(`[upload-to-ipfs] Uploading image: ${imageFilename} (${imageBytes.length} bytes)`)
    
    let imageCid: string | null = null
    let uploadAttempt = 0
    const maxAttempts = 3
    const retryDelays = [0, 1000, 2000]
    
    while (uploadAttempt < maxAttempts && !imageCid) {
      try {
        if (uploadAttempt > 0) {
          console.log(`[upload-to-ipfs] Retry attempt ${uploadAttempt + 1}/${maxAttempts}`)
          await new Promise(r => setTimeout(r, retryDelays[uploadAttempt]))
        }
        
        imageCid = await uploadToPinata(
          imageBytes, 
          imageFilename, 
          `image/${imageType}`,
          pinataJwt
        )
      } catch (e) {
        console.error(`[upload-to-ipfs] Image upload attempt ${uploadAttempt + 1} failed:`, e)
        uploadAttempt++
        
        // Check for rate limiting
        if (e instanceof Error && e.message.includes('RATE_LIMITED')) {
          return failResponse(
            'IPFS service rate limited. Please retry shortly.',
            'PROVIDER_RATE_LIMITED',
            remaining,
            { retryAfter: 30 }
          )
        }
      }
    }
    
    if (!imageCid) {
      return failResponse(
        'Failed to upload image after multiple attempts',
        'UPLOAD_FAILED',
        remaining,
        { attempts: maxAttempts }
      )
    }
    
    console.log(`[upload-to-ipfs] Image uploaded to IPFS: ${imageCid}`)

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
    
    console.log(`[upload-to-ipfs] Uploading metadata: ${metadataFilename}`)
    
    let metadataCid: string | null = null
    uploadAttempt = 0
    
    while (uploadAttempt < maxAttempts && !metadataCid) {
      try {
        if (uploadAttempt > 0) {
          await new Promise(r => setTimeout(r, retryDelays[uploadAttempt]))
        }
        
        metadataCid = await uploadToPinata(
          metadataJson,
          metadataFilename,
          'application/json',
          pinataJwt
        )
      } catch (e) {
        console.error(`[upload-to-ipfs] Metadata upload attempt ${uploadAttempt + 1} failed:`, e)
        uploadAttempt++
      }
    }
    
    if (!metadataCid) {
      // Image succeeded but metadata failed - return partial success
      return failResponse(
        'Image uploaded but metadata upload failed',
        'PARTIAL_UPLOAD',
        remaining,
        { 
          imageCid,
          imageUrl: `ipfs://${imageCid}`,
          imageGatewayUrl: `https://gateway.pinata.cloud/ipfs/${imageCid}`
        }
      )
    }
    
    console.log(`[upload-to-ipfs] Metadata uploaded to IPFS: ${metadataCid}`)

    // Return success with full data
    const tokenURI = `ipfs://${metadataCid}`

    return successResponse({
      cid: metadataCid,
      tokenURI,
      imageCid,
      imageUrl: `ipfs://${imageCid}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${metadataCid}`,
      imageGatewayUrl: `https://gateway.pinata.cloud/ipfs/${imageCid}`,
    }, remaining)
    
  } catch (error: unknown) {
    console.error('[upload-to-ipfs] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    
    // Always return 200 with error info
    return failResponse(
      `Upload failed: ${message}`,
      'UNEXPECTED_ERROR',
      remaining
    )
  }
})
