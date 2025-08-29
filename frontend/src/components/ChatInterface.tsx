import { useState, useRef, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import axios from 'axios'
import PhotoAnnotationEditor from './PhotoAnnotationEditor'

interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content?: string
  originalContent?: string
  imageData?: string
  timestamp: Date
  loading?: boolean
  analysisId?: string
  isEdited?: boolean
}

interface ChatInterfaceProps {
  user: User
}

export default function ChatInterface({ user }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('Describe the contents of this image in detail. Be specific about objects, people, colors, and activities you see.')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false)
  const [imageToAnnotate, setImageToAnnotate] = useState<string | null>(null)
  const [isFromCamera, setIsFromCamera] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const handleImageUpload = async (file: File, fromCamera: boolean = false) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Convert file to base64
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string
      
      if (fromCamera) {
        // Show annotation editor for camera photos
        setImageToAnnotate(base64Data)
        setIsFromCamera(true)
        setShowAnnotationEditor(true)
      } else {
        // Direct upload for regular files
        await processImageUpload(base64Data)
      }
    }

    reader.readAsDataURL(file)
  }

  const processImageUpload = async (base64Data: string, annotationState?: any) => {
    setUploadingImage(true)

    // Add user message with image
    const userMessageId = Date.now().toString()
    const userMessage: ChatMessage = {
      id: userMessageId,
      type: 'user',
      imageData: base64Data,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])

    // Add loading AI message
    const loadingMessageId = (Date.now() + 1).toString()
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      type: 'ai',
      content: 'Analyzing your image...',
      timestamp: new Date(),
      loading: true,
    }

    setMessages(prev => [...prev, loadingMessage])

    try {
      // Send to Flask backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
      const payload: any = {
        image: base64Data,
        user_id: user.id,
        custom_prompt: customPrompt,
      }

      // Add annotation data if available
      if (annotationState) {
        payload.annotation_state = annotationState
        payload.custom_prompt = `${customPrompt}\n\nNote: This image contains user annotations highlighting specific areas of interest.`
      }

      const response = await axios.post(`${apiUrl}/upload-image`, payload)

      // Replace loading message with actual analysis
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessageId 
            ? {
                ...msg,
                content: response.data.analysis,
                originalContent: response.data.analysis,
                loading: false,
                analysisId: response.data.analysis_id,
              }
            : msg
        )
      )
    } catch (error: any) {
      console.error('Error uploading image:', error)
      
      // Replace loading message with error
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessageId 
            ? {
                ...msg,
                content: `Sorry, I encountered an error analyzing your image: ${error.response?.data?.error || error.message}`,
                loading: false,
              }
            : msg
        )
      )
    } finally {
      setUploadingImage(false)
    }
  }

  const handleEditMessage = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId)
    setEditText(currentContent)
  }

  const handleSaveEdit = async (messageId: string, analysisId?: string) => {
    if (!analysisId) return
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
      await axios.put(`${apiUrl}/update-analysis/${analysisId}`, {
        analysis_text: editText,
        user_id: user.id,
      })
      
      // Update message in state
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? {
                ...msg,
                content: editText,
                isEdited: true,
              }
            : msg
        )
      )
      
      setEditingMessageId(null)
      setEditText('')
    } catch (error: any) {
      console.error('Error saving edit:', error)
      alert('Failed to save edit: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditText('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file, false)
    }
    // Reset the input value to allow selecting the same file again
    e.target.value = ''
  }

  const handleCameraSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file, true) // fromCamera = true
    }
    // Reset the input value to allow selecting the same file again
    e.target.value = ''
  }

  const handleAnnotationSave = async (annotatedImageData: string, annotationState: any) => {
    setShowAnnotationEditor(false)
    await processImageUpload(annotatedImageData, annotationState)
    setImageToAnnotate(null)
    setIsFromCamera(false)
  }

  const handleAnnotationCancel = () => {
    setShowAnnotationEditor(false)
    setImageToAnnotate(null)
    setIsFromCamera(false)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-80 bg-white shadow-sm border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Custom Prompt</h2>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              AI Analysis Prompt
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter your custom prompt for image analysis..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500">
              This prompt will be used for analyzing uploaded images.
            </p>
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="text-center text-gray-500">
            <p className="text-sm">Upload an image to see AI analysis using your custom prompt.</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Image Analysis Chat</h1>
            <p className="text-sm text-gray-600">Welcome, {user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Sign Out
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-12">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                </svg>
              </div>
              <p>Upload an image to start the conversation!</p>
              <p className="text-sm mt-2">I'll analyze your image using your custom prompt.</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${editingMessageId === message.id && message.type === 'ai' ? 'w-full' : 'max-w-xs lg:max-w-md'} px-4 py-2 rounded-lg ${
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white text-gray-900 shadow-sm border'
                  }`}>
                    {message.imageData && (
                      <img 
                        src={message.imageData} 
                        alt="Uploaded image" 
                        className="rounded-lg mb-2 max-w-full h-auto"
                      />
                    )}
                    {message.content && (
                      <div>
                        {editingMessageId === message.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full p-3 text-sm border rounded resize-none h-32 focus:ring-2 focus:ring-blue-500 text-gray-900"
                              placeholder="Edit the AI response..."
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleSaveEdit(message.id, message.analysisId)}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative group">
                            <p className={`text-sm ${message.loading ? 'italic' : ''}`}>
                              {message.content}
                              {message.loading && <span className="animate-pulse">...</span>}
                              {message.isEdited && <span className="text-xs text-gray-500 ml-2">(edited)</span>}
                            </p>
                            {message.type === 'ai' && !message.loading && message.analysisId && (
                              <button
                                onClick={() => handleEditMessage(message.id, message.content || '')}
                                className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 bg-blue-500 text-white rounded-full p-1 text-xs hover:bg-blue-600 transition-opacity"
                                title="Edit response"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <p className={`text-xs mt-1 ${message.type === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center space-x-4 flex-wrap gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={cameraInputRef}
                onChange={handleCameraSelect}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {uploadingImage ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                ) : (
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                  </svg>
                )}
                {uploadingImage ? 'Uploading...' : 'Upload Image'}
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                📝 Photo + Annotate
              </button>
              <p className="text-sm text-gray-500">
                Upload an image directly or take a photo with advanced annotation tools for better AI analysis
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Annotation Editor */}
      {showAnnotationEditor && imageToAnnotate && (
        <PhotoAnnotationEditor
          imageData={imageToAnnotate}
          onSave={handleAnnotationSave}
          onCancel={handleAnnotationCancel}
          customPrompt={customPrompt}
        />
      )}
    </div>
  )
}