import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory rate limiting (per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 10 // Max requests per window
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

// Allowed style values
const ALLOWED_STYLES = [
  'classic oil painting style',
  'pixel art retro game style',
  'anime illustration style',
  '3D rendered sculpture style',
  'cyberpunk neon style',
  'dark gothic fantasy style',
  'mythic fantasy illustration style'
]

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
    const { prompt, style } = body

    // Validate required fields
    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!style || typeof style !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Style is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate prompt length (max 500 characters)
    if (prompt.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Prompt must be 500 characters or less' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize prompt - remove control characters
    const sanitizedPrompt = prompt.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim()
    
    if (sanitizedPrompt.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Prompt cannot be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate style against allowed values (case-insensitive check)
    const normalizedStyle = style.toLowerCase().trim()
    const isValidStyle = ALLOWED_STYLES.some(s => s.toLowerCase() === normalizedStyle)
    if (!isValidStyle) {
      return new Response(
        JSON.stringify({ error: 'Invalid style selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN')
    if (!accessToken) {
      console.error('HUGGING_FACE_ACCESS_TOKEN is not set')
      return new Response(
        JSON.stringify({ error: 'Image generation service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Combine user prompt with style prompt
    const fullPrompt = `${sanitizedPrompt}, ${style}, high quality, detailed, masterpiece`
    console.log(`Generating image for IP ${clientIp}, remaining: ${remaining}`)

    // Use the Hugging Face router endpoint
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: fullPrompt,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Hugging Face API error:', response.status, errorText)
      // Don't expose external API details to client
      return new Response(
        JSON.stringify({ error: 'Image generation failed. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the image as array buffer
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Convert to base64
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length))
      binary += String.fromCharCode(...chunk)
    }
    const base64 = btoa(binary)
    const imageData = `data:image/png;base64,${base64}`

    console.log('Image generated successfully')

    return new Response(
      JSON.stringify({ image: imageData }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(remaining)
        } 
      }
    )
  } catch (error: unknown) {
    console.error('Error generating image:', error)
    // Don't expose internal error details to client
    return new Response(
      JSON.stringify({ error: 'Failed to generate image. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
