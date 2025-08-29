const { createClient } = require('@supabase/supabase-js');

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
  
  // Only allow PUT requests
  if (event.httpMethod !== 'PUT') {
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
    // Extract analysis ID from path
    const pathParts = event.path.split('/');
    const analysisId = pathParts[pathParts.length - 1];
    
    if (!analysisId || analysisId === 'update-analysis') {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Missing analysis ID in path' })
      };
    }
    
    // Parse request body
    const data = JSON.parse(event.body);
    
    if (!data.analysis_text || !data.user_id) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Missing analysis_text or user_id' })
      };
    }
    
    const { analysis_text, user_id } = data;
    
    console.log('Updating analysis:', { analysisId, userId: user_id, textLength: analysis_text.length });
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Supabase configuration missing' })
      };
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Update analysis in database
    const { data: updatedRecord, error: updateError } = await supabase
      .from('analysis')
      .update({
        analysis_text: analysis_text,
        is_edited: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId)
      .eq('user_id', user_id) // Ensure user can only edit their own analyses
      .select()
      .single();
    
    if (updateError) {
      console.error('Failed to update analysis:', updateError);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Failed to update analysis', details: updateError.message })
      };
    }
    
    if (!updatedRecord) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Analysis not found or not authorized' })
      };
    }
    
    console.log('Analysis updated successfully:', updatedRecord.id);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        analysis: updatedRecord
      })
    };
    
  } catch (functionError) {
    console.error('Function error:', functionError);
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