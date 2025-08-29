const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: ''
    };
  }
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    // Parse request body
    const data = JSON.parse(event.body);
    
    if (!data.image || !data.user_id) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Missing image or user_id' })
      };
    }
    
    const { image: imageData, user_id: userId, custom_prompt: customPrompt = 'Describe the contents of this image in detail. Be specific about objects, people, colors, and activities you see.' } = data;
    
    console.log('Function called with data:', { 
      hasImage: !!imageData, 
      imageLength: imageData?.length, 
      userId, 
      customPrompt: customPrompt?.substring(0, 50) + '...'
    });
    
    // Initialize Supabase client
    console.log('Creating Supabase client...');
    console.log('Environment variables available:', {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY
    });
    
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Supabase configuration missing',
          debug: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey
          }
        })
      };
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Initialize Gemini AI
    console.log('Creating Gemini AI client...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
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
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Failed to store image', details: imageError })
      };
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
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_id: imageId,
        analysis: analysisText,
        analysis_id: analysisRecord?.id || null,
        status: 'completed'
      })
    };
    
  } catch (functionError) {
    console.error('Function error:', functionError);
    console.error('Error details:', {
      message: functionError.message,
      stack: functionError.stack,
      name: functionError.name
    });
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: `Function error: ${String(functionError)}`,
        details: {
          message: functionError.message,
          name: functionError.name
        }
      })
    };
  }
};