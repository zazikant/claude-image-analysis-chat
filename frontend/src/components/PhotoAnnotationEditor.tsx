import React, { useRef, useEffect, useState, useCallback } from 'react'

interface PhotoAnnotationEditorProps {
  imageData: string
  onSave: (annotatedImageData: string, annotationState: any) => void
  onCancel: () => void
  customPrompt?: string
}

interface Annotation {
  type: 'rectangle' | 'circle' | 'arrow' | 'text'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  text?: string
  color: string
}

export default function PhotoAnnotationEditor({ 
  imageData, 
  onSave, 
  onCancel, 
  customPrompt 
}: PhotoAnnotationEditorProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [currentTool, setCurrentTool] = useState<string>('rectangle')
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null)
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [textPosition, setTextPosition] = useState<{x: number, y: number} | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load image and setup canvas
  useEffect(() => {
    if (imageRef.current && canvasRef.current) {
      const img = imageRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      
      const setupCanvas = () => {
        // Set canvas size to match image
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        
        // Scale canvas display to fit container
        const maxWidth = 800
        const maxHeight = 600
        const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1)
        
        canvas.style.width = `${img.naturalWidth * scale}px`
        canvas.style.height = `${img.naturalHeight * scale}px`
        
        redrawCanvas()
      }
      
      if (img.complete) {
        setupCanvas()
      } else {
        img.addEventListener('load', setupCanvas)
      }
    }
  }, [imageData, annotations])

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    
    // Draw annotations
    annotations.forEach(annotation => {
      ctx.strokeStyle = annotation.color
      ctx.fillStyle = annotation.color + '40'
      ctx.lineWidth = 3
      
      switch (annotation.type) {
        case 'rectangle':
          if (annotation.width && annotation.height) {
            ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height)
            ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height)
          }
          break
        case 'circle':
          if (annotation.radius) {
            ctx.beginPath()
            ctx.arc(annotation.x, annotation.y, annotation.radius, 0, 2 * Math.PI)
            ctx.stroke()
            ctx.fill()
          }
          break
        case 'arrow':
          if (annotation.width && annotation.height) {
            const endX = annotation.x + annotation.width
            const endY = annotation.y + annotation.height
            
            // Draw line
            ctx.beginPath()
            ctx.moveTo(annotation.x, annotation.y)
            ctx.lineTo(endX, endY)
            ctx.stroke()
            
            // Draw arrowhead
            const angle = Math.atan2(annotation.height, annotation.width)
            const arrowLength = 20
            ctx.beginPath()
            ctx.moveTo(endX, endY)
            ctx.lineTo(endX - arrowLength * Math.cos(angle - Math.PI / 6), endY - arrowLength * Math.sin(angle - Math.PI / 6))
            ctx.moveTo(endX, endY)
            ctx.lineTo(endX - arrowLength * Math.cos(angle + Math.PI / 6), endY - arrowLength * Math.sin(angle + Math.PI / 6))
            ctx.stroke()
          }
          break
        case 'text':
          if (annotation.text) {
            ctx.font = '16px Arial'
            ctx.fillStyle = annotation.color
            ctx.fillText(annotation.text, annotation.x, annotation.y)
          }
          break
      }
    })
  }, [annotations])


  const getEventCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    let clientX: number, clientY: number
    
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      // Mouse event
      clientX = e.clientX
      clientY = e.clientY
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const coords = getEventCoordinates(e)
    
    if (currentTool === 'text') {
      setTextPosition(coords)
      setShowTextInput(true)
      return
    }
    
    setIsDrawing(true)
    setStartPoint(coords)
  }

  const handleEnd = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing || !startPoint) return
    
    const coords = getEventCoordinates(e)
    const newAnnotation: Annotation = {
      type: currentTool as any,
      x: startPoint.x,
      y: startPoint.y,
      color: currentColor
    }

    switch (currentTool) {
      case 'rectangle':
        newAnnotation.width = coords.x - startPoint.x
        newAnnotation.height = coords.y - startPoint.y
        break
      case 'circle':
        const radius = Math.sqrt(Math.pow(coords.x - startPoint.x, 2) + Math.pow(coords.y - startPoint.y, 2))
        newAnnotation.radius = radius
        break
      case 'arrow':
        newAnnotation.width = coords.x - startPoint.x
        newAnnotation.height = coords.y - startPoint.y
        break
    }

    setAnnotations(prev => [...prev, newAnnotation])
    setIsDrawing(false)
    setStartPoint(null)
  }

  const handleTextSubmit = () => {
    if (textInput.trim() && textPosition) {
      const textAnnotation: Annotation = {
        type: 'text',
        x: textPosition.x,
        y: textPosition.y,
        text: textInput.trim(),
        color: currentColor
      }
      setAnnotations(prev => [...prev, textAnnotation])
      setTextInput('')
      setShowTextInput(false)
      setTextPosition(null)
    }
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const annotatedImageData = canvas.toDataURL('image/png')
    const annotationState = {
      annotations,
      imageWidth: canvas.width,
      imageHeight: canvas.height
    }
    
    onSave(annotatedImageData, annotationState)
  }

  const handleClear = () => {
    if (annotations.length > 0 && window.confirm('Clear all annotations?')) {
      setAnnotations([])
    }
  }

  const handleUndo = () => {
    if (annotations.length > 0) {
      setAnnotations(prev => prev.slice(0, -1))
    }
  }

  const annotationTools = [
    { id: 'rectangle', name: 'Rectangle', icon: '▭', description: 'Draw rectangles' },
    { id: 'circle', name: 'Circle', icon: '○', description: 'Draw circles' },
    { id: 'arrow', name: 'Arrow', icon: '→', description: 'Draw arrows' },
    { id: 'text', name: 'Text', icon: 'T', description: 'Add text' }
  ]

  const colorPresets = [
    { name: 'Red', color: '#ff6b6b' },
    { name: 'Blue', color: '#4dabf7' },
    { name: 'Green', color: '#51cf66' },
    { name: 'Yellow', color: '#ffd43b' },
    { name: 'Purple', color: '#9775fa' },
    { name: 'Orange', color: '#ff922b' },
    { name: 'Pink', color: '#f783ac' },
    { name: 'Teal', color: '#20c997' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl max-h-[95vh] w-full mx-4 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Annotate Photo</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              disabled={annotations.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Save & Analyze
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b bg-gray-50">
          <div className="flex flex-wrap gap-2 mb-3">
            {annotationTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setCurrentTool(tool.id)}
                className={`flex items-center space-x-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  currentTool === tool.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border shadow-sm'
                }`}
                title={tool.description}
              >
                <span className="text-lg">{tool.icon}</span>
                <span>{tool.name}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleUndo}
                disabled={annotations.length === 0}
                className="flex items-center space-x-1 px-4 py-3 bg-white border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 min-h-[44px] shadow-sm"
              >
                <span className="text-lg">↶</span>
                <span>Undo</span>
              </button>
              <button
                onClick={handleClear}
                disabled={annotations.length === 0}
                className="flex items-center space-x-1 px-4 py-3 bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm hover:bg-red-200 disabled:opacity-50 min-h-[44px] shadow-sm"
              >
                <span className="text-lg">🗑️</span>
                <span>Clear All</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">Colors:</span>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => setCurrentColor(preset.color)}
                    className={`w-10 h-10 rounded-full border-3 hover:scale-105 transition-transform shadow-sm ${
                      currentColor === preset.color ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Help Text */}
        {customPrompt && (
          <div className="p-3 bg-blue-50 border-b">
            <p className="text-sm text-blue-800">
              <strong>AI Prompt:</strong> {customPrompt}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Use the annotation tools to highlight important areas for better AI analysis.
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="relative flex justify-center" ref={containerRef}>
            <div className="relative">
              <img
                ref={imageRef}
                src={imageData}
                alt="Photo to annotate"
                className="hidden"
              />
              <canvas
                ref={canvasRef}
                onMouseDown={handleStart}
                onMouseUp={handleEnd}
                onTouchStart={handleStart}
                onTouchEnd={handleEnd}
                className="border border-gray-300 cursor-crosshair max-w-full max-h-[60vh] object-contain touch-none"
                style={{ touchAction: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Text Input Modal */}
        {showTextInput && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Add Text</h3>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter text..."
                className="w-full p-2 border rounded mb-3"
                autoFocus
                onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleTextSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowTextInput(false)
                    setTextInput('')
                    setTextPosition(null)
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-600">
            Click and drag to create shapes. Use different tools and colors to highlight important areas.
          </p>
        </div>
      </div>
    </div>
  )
}