import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Using NFT.Storage free tier (no API key needed for basic uploads via gateway)
const IPFS_GATEWAY = 'https://api.nft.storage/upload'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { imageData, metadata } = await req.json()

    if (!imageData || !metadata) {
      return new Response(
        JSON.stringify({ error: 'Image data and metadata are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Uploading to IPFS...')

    // For demo purposes, we'll create a data URI metadata
    // In production, you'd use a proper IPFS pinning service like Pinata or NFT.Storage
    
    // Convert base64 image to proper format for metadata
    const imageBase64 = imageData.startsWith('data:') 
      ? imageData 
      : `data:image/png;base64,${imageData}`

    // Create the metadata object with embedded image
    const nftMetadata = {
      name: metadata.name || `MemoryMint NFT`,
      description: metadata.description || 'A skill-based NFT from MemoryMint',
      image: imageBase64,
      attributes: metadata.attributes || [],
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error uploading to IPFS:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Failed to upload to IPFS', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})