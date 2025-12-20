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

// Allowed style values - must match frontend STYLE_OPTIONS prompts
const ALLOWED_STYLES = [
  'oil painting style, classical art, rich colors, brushwork texture',
  'pixel art style, 8-bit retro, vibrant colors, nostalgic',
  'anime style, japanese animation, vibrant, detailed',
  '3d rendered, clay sculpture, soft lighting, depth',
  'cyberpunk style, neon lights, futuristic, dark atmosphere',
  'dark gothic style, mysterious, dramatic shadows, ornate details',
  'fantasy art style, magical, ethereal, epic composition'
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

    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) {
      console.error('LOVABLE_API_KEY is not set')
      return new Response(
        JSON.stringify({ error: 'Image generation service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Combine user prompt with style prompt
    const fullPrompt = `${sanitizedPrompt}, ${style}, high quality, detailed, masterpiece, 1024x1024`
    console.log(`Generating image for IP ${clientIp}, remaining: ${remaining}`)

    // Use Lovable AI Gateway with image generation model
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: `Generate a beautiful, high-quality image: ${fullPrompt}`
          }
        ],
        modalities: ['image', 'text']
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Lovable AI API error:', response.status, errorText)
      
      // Parse error details if JSON
      let errorMessage = 'Image generation failed. Please try again.'
      let errorCode = 'generation_failed'
      
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.message) {
          errorMessage = errorData.message
        }
        if (errorData.type) {
          errorCode = errorData.type
        }
      } catch {
        // Not JSON, use default message
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Too many requests. Please wait a moment and try again.',
            code: 'rate_limited'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (response.status === 402) {
        console.error('Payment required - out of Lovable AI credits')
        return new Response(
          JSON.stringify({ 
            error: 'AI credits exhausted. The app owner needs to add credits to continue using AI image generation.',
            code: 'payment_required'
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: 'AI service authentication failed. Please contact support.',
            code: 'auth_failed'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, code: errorCode }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    
    // Extract the image from the response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
    
    if (!imageUrl) {
      console.error('No image in response:', JSON.stringify(data))
      return new Response(
        JSON.stringify({ error: 'Image generation failed. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Image generated successfully via Lovable AI')

    return new Response(
      JSON.stringify({ image: imageUrl }),
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
    return new Response(
      JSON.stringify({ error: 'Failed to generate image. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
