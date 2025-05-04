import { NextRequest, NextResponse } from 'next/server';

// Multiple IPFS gateways for fallback
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
 
  'https://dweb.link/ipfs/',
  'https://ipfs.fleek.co/ipfs/',
  'https://nftstorage.link/ipfs/'
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders
  });
}

export async function GET(request: NextRequest) {
  try {
    // Extract hash from URL
    const { searchParams } = new URL(request.url);
    let hash = searchParams.get('hash');
    
    // Check if we have a direct hash or need to extract from URL
    if (!hash) {
      const url = searchParams.get('url');
      if (!url) {
        return NextResponse.json({ error: 'Either hash or url parameter is required' }, { 
          status: 400,
          headers: corsHeaders
        });
      }
      
      // Extract hash from various URL formats
      if (url.includes('/ipfs/')) {
        const parts = url.split('/ipfs/');
        hash = parts.length > 1 ? parts.pop() || null : null;
      } else if (url.startsWith('ipfs://')) {
        hash = url.substring(7);
      } else {
        // Try to extract hash as the last path segment
        const segments = url.split('/');
        const possibleHash = segments[segments.length - 1];
        if (possibleHash && possibleHash.length >= 20) {
          hash = possibleHash;
        } else {
          return NextResponse.json({ error: 'Could not extract valid IPFS hash from URL' }, { 
            status: 400,
            headers: corsHeaders
          });
        }
      }
    }
    
    // Check for valid hash
    if (!hash || hash.length < 20) {
      return NextResponse.json({ error: 'Invalid IPFS hash' }, { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    console.log(`Processing IPFS request for hash: ${hash}`);
    
    // Try each gateway until one responds
    let metadata = null;
    let anyResponse = false;
    
    // Set a timeout for the entire operation - 10 seconds max
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gateway requests timed out')), 10000);
    });
    
    // Try a concurrent fetch from multiple gateways
    const fetchPromises = IPFS_GATEWAYS.map(async (gateway) => {
      try {
        const gatewayUrl = `${gateway}${hash}`;
        console.log(`Trying gateway: ${gatewayUrl}`);
        
        // Use fetch with a timeout signal
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout per gateway
        
        const response = await fetch(gatewayUrl, { 
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.log(`Gateway ${gateway} returned status ${response.status}`);
          return null;
        }
        
        const contentType = response.headers.get('content-type');
        
        // Handle JSON metadata
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        
        // For images or other content, create a simple metadata structure
        if (contentType) {
          return {
            gatewayUrl: gatewayUrl,
            contentType: contentType
          };
        }
        
        // Attempt to parse as JSON even if content type is different
        try {
          return await response.json();
        } catch (e) {
          // If that fails, return raw URL
          return {
            gatewayUrl: gatewayUrl
          };
        }
      } catch (error) {
        console.log(`Error from gateway: ${gateway}`, error);
        return null;
      }
    });
    
    // Race all gateway requests with a timeout
    try {
      const results = await Promise.race([
        Promise.all(fetchPromises),
        timeoutPromise
      ]) as (any[] | null);
      
      // Find the first successful response
      if (results) {
        for (const result of results) {
          if (result) {
            metadata = result;
            anyResponse = true;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Timeout or error in fetching from gateways:', error);
    }
    
    // If no gateway responded with good data, return an error
    if (!anyResponse || !metadata) {
      return NextResponse.json({ error: 'Unable to fetch data from any IPFS gateway' }, { 
        status: 502,
        headers: corsHeaders
      });
    }
    
    // Return the metadata with CORS headers
    return NextResponse.json(metadata, { headers: corsHeaders });
  } catch (error) {
    console.error('Error in IPFS fetch:', error);
    
    // Return error information
    return NextResponse.json({
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
} 