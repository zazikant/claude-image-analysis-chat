import type { Context, Config } from "@netlify/functions";
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    
    // Initialize Supabase client
    const supabaseUrl = Netlify.env.get('SUPABASE_URL');
    const supabaseKey = Netlify.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase configuration missing' }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Store image in Supabase
    const { data: imageRecord, error: imageError } = await supabase
      .table('images')
      .insert({
        user_id: userId,
        image_data: imageData,
        status: 'processing'
      })
      .select()
      .single();
    
    if (imageError || !imageRecord) {
      return new Response(JSON.stringify({ error: 'Failed to store image' }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      });
    }
    
    const imageId = imageRecord.id;
    
    // Initialize Gemini model
    const geminiApiKey = Netlify.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      });
    }
    
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Process image with Gemini
    try {
      // Convert base64 to proper format for Gemini
      const base64Data = imageData.split(',')[1];
      const mimeType = imageData.split(';')[0].split(':')[1];
      
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      };
      
      // Generate analysis using Gemini with custom prompt
      const result = await model.generateContent([customPrompt, imagePart]);
      const analysisText = result.response.text();
      
      // Store analysis results
      const { data: analysisRecord, error: analysisError } = await supabase
        .table('analysis')
        .insert({
          image_id: imageId,
          user_id: userId,
          analysis_text: analysisText,
          custom_prompt: customPrompt,
          status: 'completed',
          is_edited: false
        })
        .select()
        .single();
      
      if (analysisError) {
        console.error('Failed to store analysis:', analysisError);
      }
      
      // Update image status
      await supabase
        .table('images')
        .update({ status: 'completed' })
        .eq('id', imageId);
      
      return new Response(JSON.stringify({
        image_id: imageId,
        analysis: analysisText,
        analysis_id: analysisRecord?.id || null,
        status: 'completed'
      }), {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      });
      
    } catch (aiError) {
      console.error('AI analysis failed:', aiError);
      
      // Update image status to failed
      await supabase
        .table('images')
        .update({
          status: 'failed',
          error_message: String(aiError)
        })
        .eq('id', imageId);
      
      return new Response(JSON.stringify({ error: `AI analysis failed: ${String(aiError)}` }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      });
    }
    
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