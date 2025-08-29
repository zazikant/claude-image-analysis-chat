import React, { useRef, useEffect, useState, useCallback } from 'react'
import { MarkerArea } from '@markerjs/markerjs3'
import '@markerjs/markerjs3/markerjs3.css'

interface PhotoAnnotationEditorProps {
  imageData: string
  onSave: (annotatedImageData: string, annotationState: any) => void
  onCancel: () => void
  customPrompt?: string
}

interface AnnotationState {
  width: number
  height: number
  markers: any[]
}

export default function PhotoAnnotationEditor({ 
  imageData, 
  onSave, 
  onCancel, 
  customPrompt 
}: PhotoAnnotationEditorProps) {
  const [markerArea, setMarkerArea] = useState<MarkerArea | null>(null)
  const [currentTool, setCurrentTool] = useState<string>('select')
  const [annotationState, setAnnotationState] = useState<AnnotationState | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize MarkerArea when image loads
  useEffect(() => {
    if (imageRef.current && containerRef.current) {
      const img = imageRef.current
      
      const initializeMarkerArea = () => {
        // Create MarkerArea instance
        const markerAreaInstance = new MarkerArea()
        markerAreaInstance.targetImage = img
        
        // Configure marker area - marker.js 3 uses different API
        // Settings are configured via CSS and method calls rather than settings object
        
        // Append to container
        containerRef.current?.appendChild(markerAreaInstance)
        
        // Set up event listeners for marker.js 3
        const updateState = () => {
          try {
            setAnnotationState(markerAreaInstance.getState())
            setCanUndo(markerAreaInstance.isUndoPossible || false)
            setCanRedo(markerAreaInstance.isRedoPossible || false)
          } catch (error) {
            console.warn('Error updating annotation state:', error)
          }
        }
        
        // Use marker.js 3 specific events with proper typing
        markerAreaInstance.addEventListener('markerchange' as any, updateState)
        markerAreaInstance.addEventListener('markercreated' as any, updateState)
        markerAreaInstance.addEventListener('markerdeleted' as any, updateState)
        markerAreaInstance.addEventListener('markerselected' as any, updateState)
        
        setMarkerArea(markerAreaInstance)
      }
      
      if (img.complete) {
        initializeMarkerArea()
      } else {
        img.addEventListener('load', initializeMarkerArea)
      }
    }
    
    return () => {
      if (markerArea) {
        markerArea.destroy?.()
      }
    }
  }, [imageData])

  // Annotation tools
  const annotationTools = [
    { id: 'select', name: 'Select', icon: '↖️', description: 'Select and move annotations' },
    { id: 'ArrowMarker', name: 'Arrow', icon: '→', description: 'Draw arrows to point at objects' },
    { id: 'RectMarker', name: 'Rectangle', icon: '▭', description: 'Draw rectangular highlights' },
    { id: 'EllipseMarker', name: 'Circle', icon: '○', description: 'Draw circular highlights' },
    { id: 'PolygonMarker', name: 'Polygon', icon: '⬟', description: 'Draw custom shapes' },
    { id: 'FreehandMarker', name: 'Freehand', icon: '✏️', description: 'Draw freehand annotations' },
    { id: 'TextMarker', name: 'Text', icon: 'T', description: 'Add text labels and descriptions' },
    { id: 'CalloutMarker', name: 'Callout', icon: '💬', description: 'Add speech bubbles and callouts' },
    { id: 'HighlightMarker', name: 'Highlight', icon: '🖍️', description: 'Highlight important areas' },
    { id: 'LineMarker', name: 'Line', icon: '―', description: 'Draw straight lines' },
    { id: 'CurveMarker', name: 'Curve', icon: '〜', description: 'Draw curved lines' }
  ]

  const handleToolSelect = useCallback((toolId: string) => {
    if (!markerArea) return
    
    setCurrentTool(toolId)
    
    try {
      if (toolId === 'select') {
        if (typeof markerArea.switchToSelectMode === 'function') {
          markerArea.switchToSelectMode()
        }
      } else {
        // Try to create marker - marker.js 3 API may vary
        if (typeof markerArea.createMarker === 'function') {
          markerArea.createMarker(toolId)
        } else if (typeof (markerArea as any)[toolId] === 'function') {
          (markerArea as any)[toolId]()
        }
      }
    } catch (error) {
      console.warn('Tool selection error:', error)
    }
  }, [markerArea])

  const handleUndo = useCallback(() => {
    if (markerArea && canUndo) {
      try {
        if (typeof markerArea.undo === 'function') {
          markerArea.undo()
        }
      } catch (error) {
        console.warn('Undo not available:', error)
      }
    }
  }, [markerArea, canUndo])

  const handleRedo = useCallback(() => {
    if (markerArea && canRedo) {
      try {
        if (typeof markerArea.redo === 'function') {
          markerArea.redo()
        }
      } catch (error) {
        console.warn('Redo not available:', error)
      }
    }
  }, [markerArea, canRedo])

  const handleClear = useCallback(() => {
    if (markerArea && annotationState?.markers?.length > 0) {
      if (window.confirm('Are you sure you want to clear all annotations?')) {
        try {
          // Try different clear methods that marker.js 3 might support
          if (typeof markerArea.clear === 'function') {
            markerArea.clear()
          } else if (typeof markerArea.deleteAllMarkers === 'function') {
            markerArea.deleteAllMarkers()
          } else {
            // Fallback: remove all child elements except the image
            const children = Array.from(markerArea.children)
            children.forEach(child => {
              if (child !== imageRef.current) {
                child.remove()
              }
            })
          }
          setAnnotationState(null)
        } catch (error) {
          console.warn('Error clearing annotations:', error)
        }
      }
    }
  }, [markerArea, annotationState])

  const handleSave = useCallback(async () => {
    if (!markerArea) return
    
    try {
      // Get the current state
      const state = markerArea.getState ? markerArea.getState() : annotationState
      
      // Try to render with MarkerJS 3 renderer
      try {
        const { Renderer } = await import('@markerjs/markerjs3')
        const renderer = new Renderer()
        renderer.targetImage = imageRef.current!
        
        const annotatedImageData = await renderer.rasterize(state)
        onSave(annotatedImageData, state)
      } catch (renderError) {
        // Fallback: just use the original image with annotation state
        console.warn('Renderer not available, using original image:', renderError)
        onSave(imageToAnnotate!, state)
      }
    } catch (error) {
      console.error('Error saving annotation:', error)
      alert('Error saving annotation. Please try again.')
    }
  }, [markerArea, annotationState, onSave, imageToAnnotate])

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

  const handleColorChange = useCallback((color: string) => {
    if (markerArea) {
      // marker.js 3 handles colors differently - they're applied per marker
      // Store the color preference for new markers
      markerArea.setAttribute('data-stroke-color', color)
      markerArea.setAttribute('data-fill-color', color + '40')
    }
  }, [markerArea])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl max-h-[95vh] w-full mx-4 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Annotate Photo</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              disabled={!annotationState?.markers.length}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
            {/* Annotation Tools */}
            {annotationTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool.id)}
                className={`flex items-center space-x-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  currentTool === tool.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border'
                }`}
                title={tool.description}
              >
                <span>{tool.icon}</span>
                <span>{tool.name}</span>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center space-x-1 px-3 py-2 bg-white border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Undo last action"
              >
                <span>↶</span>
                <span>Undo</span>
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="flex items-center space-x-1 px-3 py-2 bg-white border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Redo last action"
              >
                <span>↷</span>
                <span>Redo</span>
              </button>
              <button
                onClick={handleClear}
                disabled={!annotationState?.markers.length}
                className="flex items-center space-x-1 px-3 py-2 bg-red-100 text-red-700 border border-red-200 rounded text-sm hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Clear all annotations"
              >
                <span>🗑️</span>
                <span>Clear All</span>
              </button>
            </div>

            {/* Color Presets */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Colors:</span>
              <div className="flex space-x-1">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => handleColorChange(preset.color)}
                    className="w-6 h-6 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform"
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
              Annotate the important areas in your photo that relate to this prompt for better AI analysis.
            </p>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-4">
          <div className="relative flex justify-center">
            <div ref={containerRef} className="relative inline-block">
              <img
                ref={imageRef}
                src={imageData}
                alt="Photo to annotate"
                className="max-w-full max-h-[60vh] object-contain"
                style={{ display: 'block' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-600">
            Use the tools above to highlight, point out, or add notes to important areas in your photo. 
            Click "Save & Analyze" when ready to get AI analysis of your annotated image.
          </p>
        </div>
      </div>
    </div>
  )
}