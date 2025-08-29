// Shared TypeScript types for the application

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Image {
  id: number;
  user_id: string;
  image_data: string;
  original_filename?: string;
  mime_type: string;
  file_size?: number;
  status: 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  id: number;
  image_id: number;
  user_id: string;
  analysis_text: string;
  confidence_score?: number;
  model_version: string;
  processing_time_ms?: number;
  status: 'completed' | 'failed';
  created_at: string;
}

export interface ChatSession {
  id: number;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  user_id: string;
  message_type: 'user_image' | 'ai_response';
  image_id?: number;
  analysis_id?: number;
  content?: string;
  created_at: string;
}

export interface ImageUploadResponse {
  image_id: number;
  analysis: string;
  status: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}