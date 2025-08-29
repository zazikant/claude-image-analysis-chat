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
    
    console.log('Function called with data:', { 
      hasImage: !!imageData, 
      imageLength: imageData?.length, 
      userId, 
      customPrompt: customPrompt?.substring(0, 50) + '...'
    });
    
    try {
      // Test dynamic imports
      console.log('Attempting to import Supabase...');
      const { createClient } = await import('@supabase/supabase-js');
      console.log('Supabase import successful');
      
      console.log('Attempting to import Google Generative AI...');
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      console.log('Google Generative AI import successful');
      
      // Initialize clients
      console.log('Creating Supabase client...');
      const supabase = createClient(
        Netlify.env.get('SUPABASE_URL') || '',
        Netlify.env.get('SUPABASE_ANON_KEY') || ''
      );
      console.log('Supabase client created');
      
      console.log('Creating Gemini AI client...');
      const genAI = new GoogleGenerativeAI(Netlify.env.get('GEMINI_API_KEY') || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      console.log('Gemini AI client created');
      
      // Store image in Supabase
      console.log('Storing image in database...');
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
        console.error('Failed to store image:', imageError);
        return new Response(JSON.stringify({ error: 'Failed to store image', details: imageError }), {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          }
        });
      }
      
      console.log('Image stored with ID:', imageRecord.id);
      const imageId = imageRecord.id;
      
      // Convert base64 to proper format for Gemini
      console.log('Processing image for AI analysis...');
      const base64Data = imageData.split(',')[1];
      const mimeType = imageData.split(';')[0].split(':')[1];
      
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      };
      
      // Generate analysis using Gemini
      console.log('Calling Gemini AI...');
      const result = await model.generateContent([customPrompt, imagePart]);
      const analysisText = result.response.text();
      console.log('AI analysis completed, text length:', analysisText.length);
      
      // Store analysis results
      console.log('Storing analysis results...');
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
      console.log('Updating image status to completed...');
      await supabase
        .table('images')
        .update({ status: 'completed' })
        .eq('id', imageId);
      
      console.log('Function completed successfully');
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
      
    } catch (functionError) {
      console.error('Function error:', functionError);
      console.error('Error details:', {
        message: functionError.message,
        stack: functionError.stack,
        name: functionError.name
      });
      
      return new Response(JSON.stringify({ 
        error: `Function error: ${String(functionError)}`,
        details: {
          message: functionError.message,
          name: functionError.name
        }
      }), {
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