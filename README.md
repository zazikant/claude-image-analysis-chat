# AI Image Analysis Chat App

A full-stack web application that allows users to upload images and receive AI-powered analysis through a chat interface.

## Features

- **User Authentication**: Secure signup/signin with Supabase
- **Image Upload**: Upload images through a chat interface
- **AI Analysis**: Powered by Google Gemini via Langchain
- **Real-time Chat**: Live updates using Supabase REST API
- **Secure Storage**: Images stored as base64 in Supabase database

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Flask (Python)
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 1.5 Flash via Langchain
- **Authentication**: Supabase Auth
- **Real-time**: Supabase REST API

## Project Structure

```
D:\CLAUDE\
├── frontend/           # Next.js frontend application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Next.js pages
│   │   ├── lib/        # Utilities (Supabase client)
│   │   └── styles/     # CSS styles
│   ├── package.json
│   └── next.config.js
├── backend/            # Flask backend API
│   ├── app.py         # Main Flask application
│   └── requirements.txt
├── shared/             # Shared TypeScript types
│   └── types.ts
├── database_schema.sql # Database setup script
├── .env.example       # Environment variables template
└── CLAUDE.md          # Project documentation
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Supabase account
- Google Cloud account (for Gemini API)

### 1. Environment Setup

1. Copy `.env.example` to `.env` and fill in your credentials:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Flask Configuration
FLASK_SECRET_KEY=your_flask_secret_key_here
FLASK_ENV=development

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000
```

### 2. Database Setup

1. Create a new Supabase project
2. Run the SQL script in `database_schema.sql` in the Supabase SQL Editor
3. This creates all necessary tables, indexes, and Row Level Security policies

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run Flask development server
python app.py
```

The Flask API will be available at `http://localhost:5000`

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment variables for frontend
echo "NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here" >> .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here" >> .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" >> .env.local

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

## API Endpoints

### Flask Backend

- `GET /health` - Health check
- `POST /upload-image` - Upload image and get AI analysis
- `GET /analysis/<image_id>` - Get analysis by image ID
- `GET /user-images/<user_id>` - Get all images for a user

## Database Schema

### Tables

- **user_profiles**: Extended user information
- **images**: Uploaded images stored as base64
- **analysis**: AI analysis results
- **chat_sessions**: Chat conversation sessions
- **chat_messages**: Individual chat messages

All tables have Row Level Security (RLS) enabled for data protection.

## Development Workflow

1. **Phase 1**: ✅ Project setup and basic structure
2. **Phase 2**: Backend API development with Supabase integration
3. **Phase 3**: Frontend development with real-time features
4. **Phase 4**: Integration and testing
5. **Phase 5**: Deployment and production setup

## Key Features Implemented

- ✅ Project structure and configuration
- ✅ Database schema with RLS
- ✅ Flask API with Gemini integration
- ✅ Next.js frontend with Supabase auth
- ✅ Chat interface with image upload
- ✅ Real-time updates capability

## Next Steps

1. Test the complete flow locally
2. Add error handling and validation
3. Implement real-time features
4. Add testing suite
5. Deploy to production

## MCP Tools Used

- **Supabase MCP**: For database operations and queries
- **Context7 MCP**: For latest library documentation

## Contributing

1. Follow the existing code style and conventions
2. Test all changes locally
3. Update documentation as needed
4. Ensure security best practices

## License

This project is for educational and development purposes.