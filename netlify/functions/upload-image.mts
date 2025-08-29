import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      }
    });
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      }
    });
  }
  
  try {
    // Parse request body
    const data = await req.json();
    
    if (!data.image || !data.user_id) {
      return new Response(JSON.stringify({ error: 'Missing image or user_id' }), {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      });
    }
    
    const { image: imageData, user_id: userId, custom_prompt: customPrompt = 'Describe the contents of this image in detail. Be specific about objects, people, colors, and activities you see.' } = data;
    
    // For now, return a simple test response
    return new Response(JSON.stringify({
      message: 'Image upload endpoint is working',
      received: {
        user_id: userId,
        image_length: imageData ? imageData.length : 0,
        custom_prompt: customPrompt
      }
    }), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      }
    });
    
  } catch (error) {
    console.error('Upload image error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      }
    });
  }
};

export const config: Config = {
  path: "/api/upload-image"
};