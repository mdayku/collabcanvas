/**
 * AWS Lambda / Vercel Function: Image Proxy for DALL-E URLs
 * Bypasses CORS by fetching images server-side and returning them as data URLs
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    // Validate that it's an OpenAI DALL-E URL for security
    if (!imageUrl.includes('oaidalleapiprodscus.blob.core.windows.net')) {
      return res.status(400).json({ error: 'Invalid image URL - only DALL-E URLs allowed' });
    }

    console.log('[IMAGE-PROXY] Fetching image:', imageUrl.substring(0, 100) + '...');

    // Fetch the image server-side (no CORS restrictions)
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'CollabCanvas/1.0',
        'Accept': 'image/*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    // Convert to buffer then base64
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log('[IMAGE-PROXY] ✅ Image converted successfully');
    console.log('[IMAGE-PROXY] Content-Type:', contentType);
    console.log('[IMAGE-PROXY] Size:', buffer.byteLength, 'bytes');

    return res.status(200).json({ 
      success: true, 
      dataUrl,
      contentType,
      size: buffer.byteLength
    });

  } catch (error) {
    console.error('[IMAGE-PROXY] ❌ Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch image',
      details: error.message 
    });
  }
}
