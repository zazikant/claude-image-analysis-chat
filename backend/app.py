import os
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import base64
from PIL import Image
import io
import google.generativeai as genai
from supabase import create_client, Client

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')

# Enable CORS for development (allow all origins)
CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Initialize Supabase client (will be set up later)
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_ANON_KEY')

# Only create supabase client if credentials are provided
if supabase_url and supabase_key and supabase_url != 'your_supabase_url_here':
    supabase: Client = create_client(supabase_url, supabase_key)
else:
    supabase = None

# Initialize Gemini model
gemini_api_key = os.getenv('GEMINI_API_KEY')
if not gemini_api_key:
    raise ValueError("GEMINI_API_KEY not found in environment variables")

genai.configure(api_key=gemini_api_key)
model = genai.GenerativeModel('gemini-1.5-flash')

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "Flask API is running"})

@app.route('/test-gemini', methods=['GET'])
def test_gemini():
    try:
        response = model.generate_content("Say 'Hello! Gemini is working correctly.'")
        return jsonify({
            "status": "success",
            "message": "Gemini integration working",
            "response": response.text
        })
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": f"Gemini integration failed: {str(e)}"
        }), 500

@app.route('/upload-image', methods=['POST'])
def upload_image():
    try:
        data = request.get_json()
        
        if 'image' not in data or 'user_id' not in data:
            return jsonify({"error": "Missing image or user_id"}), 400
        
        image_data = data['image']
        user_id = data['user_id']
        custom_prompt = data.get('custom_prompt', 'Describe the contents of this image in detail. Be specific about objects, people, colors, and activities you see.')
        
        # For now, simulate storing image (will implement Supabase later)
        if supabase:
            # Store image in Supabase
            image_record = supabase.table('images').insert({
                'user_id': user_id,
                'image_data': image_data,
                'status': 'processing'
            }).execute()
            
            if not image_record.data:
                return jsonify({"error": "Failed to store image"}), 500
            
            image_id = image_record.data[0]['id']
        else:
            # Mock image ID for testing without Supabase
            image_id = 1
        
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
            
            return jsonify({
                "image_id": image_id,
                "analysis": analysis_text,
                "analysis_id": analysis_record.data[0]['id'] if supabase and analysis_record.data else None,
                "status": "completed"
            })
            
        except Exception as ai_error:
            # Update image status to failed (if Supabase is configured)
            if supabase:
                supabase.table('images').update({
                    'status': 'failed',
                    'error_message': str(ai_error)
                }).eq('id', image_id).execute()
            
            return jsonify({"error": f"AI analysis failed: {str(ai_error)}"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analysis/<int:image_id>', methods=['GET'])
def get_analysis(image_id):
    try:
        if not supabase:
            return jsonify({"error": "Supabase not configured"}), 500
            
        result = supabase.table('analysis').select('*').eq('image_id', image_id).execute()
        
        if not result.data:
            return jsonify({"error": "Analysis not found"}), 404
        
        return jsonify(result.data[0])
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/user-images/<user_id>', methods=['GET'])
def get_user_images(user_id):
    try:
        if not supabase:
            return jsonify({"error": "Supabase not configured"}), 500
            
        result = supabase.table('images').select('*, analysis(*)').eq('user_id', user_id).order('created_at', desc=True).execute()
        
        return jsonify(result.data)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/update-analysis/<int:analysis_id>', methods=['PUT'])
def update_analysis(analysis_id):
    try:
        if not supabase:
            return jsonify({"error": "Supabase not configured"}), 500
            
        data = request.get_json()
        
        if 'analysis_text' not in data or 'user_id' not in data:
            return jsonify({"error": "Missing analysis_text or user_id"}), 400
        
        analysis_text = data['analysis_text']
        user_id = data['user_id']
        
        # Verify user owns this analysis
        result = supabase.table('analysis').select('user_id').eq('id', analysis_id).execute()
        
        if not result.data:
            return jsonify({"error": "Analysis not found"}), 404
            
        if result.data[0]['user_id'] != user_id:
            return jsonify({"error": "Unauthorized"}), 403
        
        # Update the analysis
        update_result = supabase.table('analysis').update({
            'analysis_text': analysis_text,
            'is_edited': True
        }).eq('id', analysis_id).execute()
        
        if not update_result.data:
            return jsonify({"error": "Failed to update analysis"}), 500
        
        return jsonify({
            "message": "Analysis updated successfully",
            "analysis_id": analysis_id
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)