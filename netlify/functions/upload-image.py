import json
import os
import base64
from PIL import Image
import io
import google.generativeai as genai
from supabase import create_client, Client

def handler(event, context):
    # Handle CORS preflight requests
    if event['httpMethod'] == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            },
            'body': ''
        }
    
    # Only allow POST requests
    if event['httpMethod'] != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # Parse request body
        data = json.loads(event['body'])
        
        if 'image' not in data or 'user_id' not in data:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                'body': json.dumps({'error': 'Missing image or user_id'})
            }
        
        image_data = data['image']
        user_id = data['user_id']
        custom_prompt = data.get('custom_prompt', 'Describe the contents of this image in detail. Be specific about objects, people, colors, and activities you see.')
        
        # Initialize Supabase client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if supabase_url and supabase_key:
            supabase = create_client(supabase_url, supabase_key)
            
            # Store image in Supabase
            image_record = supabase.table('images').insert({
                'user_id': user_id,
                'image_data': image_data,
                'status': 'processing'
            }).execute()
            
            if not image_record.data:
                return {
                    'statusCode': 500,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json',
                    },
                    'body': json.dumps({'error': 'Failed to store image'})
                }
            
            image_id = image_record.data[0]['id']
        else:
            # Mock image ID for testing without Supabase
            image_id = 1
            supabase = None
        
        # Initialize Gemini model
        gemini_api_key = os.getenv('GEMINI_API_KEY')
        if not gemini_api_key:
            return {
                'statusCode': 500,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                'body': json.dumps({'error': 'GEMINI_API_KEY not configured'})
            }
        
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Process image with Gemini
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data.split(',')[1])
            
            # Convert to PIL Image
            img = Image.open(io.BytesIO(image_bytes))
            
            # Generate analysis using Gemini with custom prompt
            response = model.generate_content([custom_prompt, img])
            analysis_text = response.text
            
            # Store analysis results (if Supabase is configured)
            if supabase:
                analysis_record = supabase.table('analysis').insert({
                    'image_id': image_id,
                    'user_id': user_id,
                    'analysis_text': analysis_text,
                    'custom_prompt': custom_prompt,
                    'status': 'completed',
                    'is_edited': False
                }).execute()
                
                # Update image status
                supabase.table('images').update({
                    'status': 'completed'
                }).eq('id', image_id).execute()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                'body': json.dumps({
                    'image_id': image_id,
                    'analysis': analysis_text,
                    'analysis_id': analysis_record.data[0]['id'] if supabase and analysis_record.data else None,
                    'status': 'completed'
                })
            }
            
        except Exception as ai_error:
            # Update image status to failed (if Supabase is configured)
            if supabase:
                supabase.table('images').update({
                    'status': 'failed',
                    'error_message': str(ai_error)
                }).eq('id', image_id).execute()
            
            return {
                'statusCode': 500,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                'body': json.dumps({'error': f'AI analysis failed: {str(ai_error)}'})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            'body': json.dumps({'error': str(e)})
        }