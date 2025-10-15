import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Text as KText, Transformer, Group, Line, RegularPolygon, Image as KonvaImage } from "react-konva";
import { useCanvas } from "./state/store";
import type { ShapeBase, ShapeType } from "./types";
import { supabase } from "./lib/supabaseClient";
import { interpretWithResponse, type AIResponse } from "./ai/agent";
import { isOpenAIConfigured } from "./services/openaiService";
import { isGroqConfigured } from "./services/groqService";
import { SaveStatusIndicator } from "./components/SaveStatusIndicator";
import { useTheme } from "./contexts/ThemeContext";

// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// FPS Counter Hook
function useFps() {
  const [fps, setFps] = React.useState(0);
  React.useEffect(() => {
    let last = performance.now(), frames = 0, id: number;
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) { setFps(frames); frames = 0; last = now; }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  return fps;
}


// const CANVAS_W = 2400, CANVAS_H = 1600;

// TopRibbon Component with File Menu
function TopRibbon({ onSignOut, stageRef, setShowHelpPopup }: { 
  onSignOut: () => void; 
  stageRef: React.RefObject<any>; 
  setShowHelpPopup: (show: boolean) => void;
}) {
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [availableCanvases, setAvailableCanvases] = useState<any[]>([]);
  const [isLoadingCanvases, setIsLoadingCanvases] = useState(false);
  const { currentCanvas, shapes } = useCanvas();
  const { theme, colors, setTheme, showFPS, setShowFPS, showGrid, setShowGrid, halloweenMode, setHalloweenMode } = useTheme();
  const fps = useFps();

  const exportToPNG = () => {
    if (stageRef.current) {
      const uri = stageRef.current.toDataURL({
        mimeType: 'image/png',
        quality: 1.0,
        pixelRatio: 2 // Higher resolution export
      });
      
      const link = document.createElement('a');
      link.download = 'canvas-export.png';
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportToPDF = async () => {
    if (stageRef.current) {
      // For now, export as PNG and let user convert to PDF
      // TODO: Implement proper PDF export with jsPDF
      const uri = stageRef.current.toDataURL({
        mimeType: 'image/png',
        quality: 1.0,
        pixelRatio: 2
      });
      
      const link = document.createElement('a');
      link.download = 'canvas-export-for-pdf.png';
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClearCanvas = async () => {
    // Save history before clearing so it can be undone
    useCanvas.getState().pushHistory();
    
    // Get all shape IDs before clearing
    const allShapeIds = Object.keys(shapes);
    
    // Clear all shapes locally
    useCanvas.getState().clear();
    
    // Broadcast removal to other users (for multiplayer sync)
    if (allShapeIds.length > 0) {
      await broadcastRemove(allShapeIds);
      
      // Delete from database
      await supabase.from("shapes").delete().eq("room_id", useCanvas.getState().roomId);
    }
    
    // Close dialogs
    setShowClearConfirmation(false);
    setShowFileMenu(false);
  };

  const handleNewCanvas = async () => {
    // Temporary disclaimer while database schema issues are resolved
    alert('New Canvas feature is temporarily unavailable due to database schema caching. Please use the current canvas with auto-save for now. Feature coming soon!');
    setShowFileMenu(false);
    return;
    
    const canvasState = useCanvas.getState();
    const hasShapes = Object.keys(canvasState.shapes).length > 0;
    
    let proceed = true;
    if (hasShapes) {
      proceed = confirm('Create a new canvas? Current shapes will be saved to the new canvas.');
    }
    
    if (proceed) {
      try {
        const title = prompt('Enter canvas title:', 'New Canvas') || 'New Canvas';
        const newCanvas = await canvasState.createNewCanvas(title);
        
        // Open the new canvas in a tab
        canvasState.openCanvasInTab(newCanvas);
      } catch (error) {
        console.error('Canvas creation error:', error);
        
        // More detailed error handling for better debugging
        if (error instanceof Error) {
          const errorDetails = error as Error;
          console.log('Full error details:', {
            message: errorDetails.message,
            stack: errorDetails.stack,
            name: errorDetails.name
          });
          
          if (errorDetails.message.includes('Failed to create canvas')) {
            alert(`Canvas creation failed: ${errorDetails.message}. This may be a temporary database issue. Please try again in a moment.`);
          } else if (errorDetails.message.includes('Failed to retrieve')) {
            alert('Canvas was created but could not be loaded immediately. Please refresh the page and check your canvases.');
          } else {
            alert(`Error: ${errorDetails.message}. Please try again or contact support if this continues.`);
          }
        } else {
          alert('Unable to create new canvas. Please check your connection and try again.');
        }
      }
    }
    setShowFileMenu(false);
  };

  const handleSave = async () => {
    const canvasState = useCanvas.getState();
    
    if (!canvasState.currentCanvas) {
      // No current canvas - save as new
      return handleSaveAs();
    }
    
    try {
      await canvasState.triggerManualSave();
      // Status indicator will handle UI feedback
    } catch (error) {
      // Error status will be shown in the status indicator
      console.error('Save failed:', error);
    }
    setShowFileMenu(false);
  };

  const handleSaveAs = async () => {
    const canvasState = useCanvas.getState();
    const currentTitle = canvasState.currentCanvas?.title || 'Untitled Canvas';
    
    const newTitle = prompt('Save canvas as:', currentTitle);
    if (newTitle && newTitle.trim()) {
      try {
        if (canvasState.currentCanvas) {
          // Save existing canvas with new title
          await canvasState.saveCurrentCanvas(newTitle.trim());
        } else {
          // Create new canvas
          await canvasState.createNewCanvas(newTitle.trim());
        }
        alert('Canvas saved successfully!');
      } catch (error) {
        alert('Failed to save canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
    setShowFileMenu(false);
  };

  const handleDuplicate = async () => {
    const canvasState = useCanvas.getState();
    
    if (!canvasState.currentCanvas) {
      alert('Please save the current canvas first before duplicating.');
      return;
    }
    
    const currentTitle = canvasState.currentCanvas.title;
    const newTitle = prompt('Duplicate canvas as:', `Copy of ${currentTitle}`);
    
    if (newTitle && newTitle.trim()) {
      try {
        const duplicatedCanvas = await canvasState.duplicateCurrentCanvas(newTitle.trim());
        
        // Ask if user wants to switch to the duplicated canvas
        const switchToNew = confirm(`Canvas duplicated successfully! Open "${duplicatedCanvas.title}" in a new tab?`);
        if (switchToNew) {
          canvasState.openCanvasInTab(duplicatedCanvas);
          await canvasState.loadCanvas(duplicatedCanvas.id);
        }
      } catch (error) {
        alert('Failed to duplicate canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
    setShowFileMenu(false);
  };

  const handleOpen = async () => {
    try {
      setIsLoadingCanvases(true);
      setShowFileMenu(false);
      
      const { canvasService } = await import('./services/canvasService');
      const canvases = await canvasService.getUserCanvases();
      
      setAvailableCanvases(canvases);
      setShowOpenDialog(true);
    } catch (error) {
      alert('Failed to load canvases: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoadingCanvases(false);
    }
  };

  const handleImportImage = () => {
    setShowFileMenu(false);
    
    // Create hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageUrl = e.target?.result as string;
          createImageShape(imageUrl);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const createImageShape = (imageUrl: string) => {
    // Create an Image object to get dimensions
    const img = new Image();
    img.onload = () => {
      const { shapes, me } = useCanvas.getState();
      
      // Calculate reasonable size (max 300px, preserve aspect ratio)
      const maxSize = 300;
      const aspectRatio = img.width / img.height;
      let width = img.width;
      let height = img.height;
      
      if (width > maxSize || height > maxSize) {
        if (aspectRatio > 1) {
          width = maxSize;
          height = maxSize / aspectRatio;
        } else {
          height = maxSize;
          width = maxSize * aspectRatio;
        }
      }
      
      // Find blank area for placement
      const position = findBlankArea(shapes, width, height);
      
      // Save history before creating
      useCanvas.getState().pushHistory();
      
      const imageShape: ShapeBase = {
        id: crypto.randomUUID(),
        type: "image",
        x: position.x,
        y: position.y,
        w: width,
        h: height,
        imageUrl: imageUrl,
        originalWidth: img.width,
        originalHeight: img.height,
        updated_at: Date.now(),
        updated_by: me.id
      };
      
      useCanvas.getState().upsert(imageShape);
      broadcastUpsert(imageShape);
      persist(imageShape);
      
      // Auto-select the new image
      useCanvas.getState().select([imageShape.id]);
    };
    img.src = imageUrl;
  };

  const handleLoadCanvas = async (canvasId: string) => {
    try {
      const canvasState = useCanvas.getState();
      
      // Get the canvas to open
      const { canvasService } = await import('./services/canvasService');
      const canvasToOpen = await canvasService.getCanvas(canvasId);
      
      if (!canvasToOpen) {
        alert('Canvas not found');
        return;
      }
      
      // Open canvas in a new tab (or switch to existing tab)
      canvasState.openCanvasInTab(canvasToOpen);
      
      // Load the canvas shapes
      await canvasState.loadCanvas(canvasId);
      
      setShowOpenDialog(false);
    } catch (error) {
      alert('Failed to load canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div 
      className="px-4 py-2 flex items-center justify-between border-b"
      style={{ 
        backgroundColor: colors.bg, 
        borderColor: colors.border,
        color: colors.text 
      }}
    >
      {/* Left side - File & View Menus */}
      <div className="flex items-center space-x-2">
        {/* File Menu */}
        <div className="relative">
          <button
            onClick={() => setShowFileMenu(!showFileMenu)}
            className="px-3 py-1.5 text-sm font-medium rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ 
              color: colors.text,
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            File
          </button>
        
        {showFileMenu && (
          <div 
            className="absolute left-0 top-full mt-1 w-48 rounded-md shadow-lg border z-50"
            style={{ 
              backgroundColor: colors.bg, 
              borderColor: colors.border 
            }}
          >
            <div className="py-1">
                <button
                  onClick={handleNewCanvas}
                  className="w-full text-left px-4 py-2 text-sm flex items-center transition-colors"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span className="mr-2">📄</span>
                  New Canvas
                </button>
                
                <button
                  onClick={handleOpen}
                  disabled={isLoadingCanvases}
                  className="w-full text-left px-4 py-2 text-sm flex items-center disabled:opacity-50 transition-colors"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => !isLoadingCanvases && (e.currentTarget.style.backgroundColor = colors.buttonHover)}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span className="mr-2">📂</span>
                  {isLoadingCanvases ? 'Loading...' : 'Open Canvas'}
                </button>
                
                <hr className="my-1" style={{ borderColor: colors.border }} />
              
              <button
                onClick={handleSave}
                className="w-full text-left px-4 py-2 text-sm flex items-center transition-colors"
                style={{ color: colors.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span className="mr-2">💾</span>
                Save
              </button>
              
              <button
                onClick={handleSaveAs}
                className="w-full text-left px-4 py-2 text-sm flex items-center transition-colors"
                style={{ color: colors.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span className="mr-2">💾</span>
                Save As...
              </button>
              
              <button
                onClick={handleDuplicate}
                className="w-full text-left px-4 py-2 text-sm flex items-center transition-colors"
                style={{ color: colors.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span className="mr-2">📋</span>
                Duplicate Canvas
              </button>
              
              <hr className="my-1 border-gray-200" />
              
              {/* Import */}
              <button
                onClick={handleImportImage}
                className="w-full text-left px-4 py-2 text-sm flex items-center transition-colors"
                style={{ color: colors.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span className="mr-2">🖼️</span>
                Import Image
              </button>
              
              <hr className="my-1" style={{ borderColor: colors.border }} />
              
              {/* Export submenu */}
              <div className="px-4 py-2">
                <div className="text-xs font-medium mb-1" style={{ color: colors.textMuted }}>Export</div>
                <button
                  onClick={exportToPNG}
                  className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span className="mr-2">🖼️</span>
                  Export as PNG
                </button>
                <button
                  onClick={exportToPDF}
                  className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span className="mr-2">📄</span>
                  Export as PDF
                </button>
              </div>
              
                <hr className="my-1" style={{ borderColor: colors.border }} />
              
              {/* Clear Canvas */}
              {Object.keys(shapes).length > 0 && (
                <button
                  onClick={() => setShowClearConfirmation(true)}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
                >
                  <span className="mr-2">🗑️</span>
                  Clear Canvas
                </button>
              )}
              
              <hr className="my-1" style={{ borderColor: colors.border }} />
              
              <button
                onClick={() => {
                  setShowFileMenu(false);
                  onSignOut();
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
              >
                <span className="mr-2">🚪</span>
                Sign Out
              </button>
            </div>
          </div>
        )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            onClick={() => setShowViewMenu(!showViewMenu)}
            className="px-3 py-1.5 text-sm font-medium rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ 
              color: colors.text,
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            View
          </button>

          {showViewMenu && (
            <div 
              className="absolute left-0 top-full mt-1 w-48 rounded-md shadow-lg border z-50"
              style={{ 
                backgroundColor: colors.bg, 
                borderColor: colors.border 
              }}
            >
              <div className="py-1">
                <div className="px-4 py-2">
                  <div className="text-xs font-medium mb-2" style={{ color: colors.textMuted }}>Theme</div>
                  <button
                    onClick={() => {
                      setTheme('light');
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: theme === 'light' ? colors.primary : 'transparent',
                      color: theme === 'light' ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (theme !== 'light') {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (theme !== 'light') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">☀️</span>
                    Light Mode
                    {theme === 'light' && <span className="ml-auto text-xs">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setTheme('dark');
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: theme === 'dark' ? colors.primary : 'transparent',
                      color: theme === 'dark' ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (theme !== 'dark') {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (theme !== 'dark') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">🌙</span>
                    Dark Mode
                    {theme === 'dark' && <span className="ml-auto text-xs">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setTheme('system');
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: theme === 'system' ? colors.primary : 'transparent',
                      color: theme === 'system' ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (theme !== 'system') {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (theme !== 'system') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">🖥️</span>
                    System Default
                    {theme === 'system' && <span className="ml-auto text-xs">✓</span>}
                  </button>
                </div>
                
                <hr className="my-1" style={{ borderColor: colors.border }} />
                
                <div className="px-4 py-2">
                  <div className="text-xs font-medium mb-2" style={{ color: colors.textMuted }}>Display</div>
                  <button
                    onClick={() => {
                      setShowFPS(!showFPS);
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: showFPS ? colors.primary : 'transparent',
                      color: showFPS ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (!showFPS) {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showFPS) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">📊</span>
                    {showFPS ? 'Hide FPS Counter' : 'Show FPS Counter'}
                    {showFPS && <span className="ml-auto text-xs">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setShowGrid(!showGrid);
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: showGrid ? colors.primary : 'transparent',
                      color: showGrid ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (!showGrid) {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showGrid) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">⚏</span>
                    Show Grid
                    {showGrid && <span className="ml-auto text-xs">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setHalloweenMode(!halloweenMode);
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: halloweenMode ? colors.primary : 'transparent',
                      color: halloweenMode ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (!halloweenMode) {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!halloweenMode) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">🎃</span>
                    Halloween Mode
                    {halloweenMode && <span className="ml-auto text-xs">✓</span>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div className="relative">
          <button
            onClick={() => setShowHelpPopup(true)}
            className="px-3 py-1.5 text-sm font-medium rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ 
              color: colors.text,
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Help
          </button>
        </div>
      </div>

      {/* Open Canvas Dialog */}
      {showOpenDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-96 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Open Canvas</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {availableCanvases.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <span className="block text-4xl mb-2">📂</span>
                  No saved canvases found
                </div>
              ) : (
                <div className="space-y-2">
                  {availableCanvases.map((canvas) => (
                    <button
                      key={canvas.id}
                      onClick={() => handleLoadCanvas(canvas.id)}
                      className="w-full text-left p-3 rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{canvas.title}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        Modified: {new Date(canvas.updated_at).toLocaleDateString()} at{' '}
                        {new Date(canvas.updated_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowOpenDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Canvas Confirmation Dialog */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div 
            className="rounded-lg p-6 max-w-sm mx-4 shadow-xl border"
            style={{ 
              backgroundColor: colors.bg,
              borderColor: colors.border,
              color: colors.text 
            }}
          >
            <h3 className="text-lg font-semibold mb-2">Clear Canvas?</h3>
            <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
              Are you sure you want to remove all {Object.keys(shapes).length} shape{Object.keys(shapes).length !== 1 ? 's' : ''} from the canvas? 
              This action can be undone with Ctrl+Z.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirmation(false)}
                className="px-4 py-2 text-sm rounded border"
                style={{
                  backgroundColor: colors.buttonBg,
                  color: colors.text,
                  borderColor: colors.border
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearCanvas}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Clear Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center - Canvas Title */}
      <div className="flex-1 text-center">
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>CollabCanvas</h1>
      </div>

          {/* Right side - FPS Counter, Canvas Info & Save Status */}
          <div className="flex items-center space-x-4">
            {/* FPS Counter */}
            {showFPS && (
              <div 
                className="px-2 py-1 rounded text-xs font-mono"
                style={{ 
                  backgroundColor: colors.bgSecondary, 
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`
                }}
              >
                FPS: {fps}
              </div>
            )}
            <div className="text-sm" style={{ color: colors.textSecondary }}>
              <span className="font-medium">
                {currentCanvas?.title || 'Untitled Canvas'}
              </span>
            </div>
            <SaveStatusIndicator />
          </div>
    </div>
  );
}

// Help Popup Component
function HelpPopup({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const { colors } = useTheme();
  const recognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const groqConfigured = isGroqConfigured();
  const openaiConfigured = isOpenAIConfigured();
  const aiConfigured = groqConfigured || openaiConfigured;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div 
        className={`rounded-lg shadow-xl border transition-all duration-300 flex flex-col ${
          isMinimized 
            ? 'w-80 h-12' 
            : 'w-[95vw] max-w-6xl h-[90vh] max-h-[800px]'
        }`}
        style={{ 
          backgroundColor: colors.bg,
          borderColor: colors.border,
          color: colors.text
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 border-b cursor-pointer flex-shrink-0"
          style={{ borderColor: colors.border }}
          onClick={() => isMinimized && setIsMinimized(false)}
        >
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
            📚 CollabCanvas Help & Guide
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              className="px-2 py-1 rounded text-sm"
              style={{ 
                backgroundColor: colors.buttonHover,
                color: colors.text
              }}
            >
              {isMinimized ? '□' : '−'}
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 rounded text-sm"
              style={{ 
                backgroundColor: colors.buttonHover,
                color: colors.text
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Column - AI Agent & Keyboard Shortcuts */}
              <div className="space-y-6">
                
                {/* AI Agent Guide */}
                <div>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
                    🤖 AI Agent Guide
                  </h3>
                  {aiConfigured ? (
                    <div className="space-y-3">
                      <div className="text-sm" style={{ color: colors.textMuted }}>
                        <strong>Quick Start:</strong> Select shapes, then give commands like "make it blue" or "move to center"
                      </div>
                      
                      <div>
                        <div className="font-medium text-sm mb-2" style={{ color: colors.text }}>Creation Commands:</div>
                        <div className="text-xs space-y-1" style={{ color: colors.textMuted }}>
                          <div>• "Create a blue 200x100 rectangle"</div>
                          <div>• "Add text saying 'Hello World'"</div>
                          <div>• "Make a red circle at 300, 200"</div>
                          <div>• "Create a login form with buttons"</div>
                          <div>• "Build a navigation bar with 4 items"</div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-sm mb-2" style={{ color: colors.text }}>Manipulation Commands:</div>
                        <div className="text-xs space-y-1" style={{ color: colors.textMuted }}>
                          <div>• "Move it to the center" | "Move right 100"</div>
                          <div>• "Make it twice as big" | "Resize to 300x200"</div>
                          <div>• "Rotate 45 degrees" | "Rotate clockwise"</div>
                          <div>• "Change color to blue" | "Make it transparent"</div>
                        </div>
                      </div>

                      <div>
                        <div className="font-medium text-sm mb-2" style={{ color: colors.text }}>Selection Commands:</div>
                        <div className="text-xs space-y-1" style={{ color: colors.textMuted }}>
                          <div>• "Select all circles" | "Select the blue rectangle"</div>
                          <div>• "Select all shapes" | "Select the largest circle"</div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-sm mb-2" style={{ color: colors.text }}>Layout Commands:</div>
                        <div className="text-xs space-y-1" style={{ color: colors.textMuted }}>
                          <div>• "Arrange in a row" | "Create a 3x2 grid"</div>
                          <div>• "Space them evenly" | "Align to center"</div>
                        </div>
                      </div>

                      {recognition && (
                        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded" style={{ color: colors.primary }}>
                          💬 <strong>Voice Input:</strong> Click the 🎤 microphone button to speak your commands!
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm space-y-2" style={{ color: colors.textMuted }}>
                      <div><strong>AI Agent Available!</strong> Configure API keys for advanced features:</div>
                      <div>• Groq API (fastest) • OpenAI API (most capable)</div>
                      <div className="text-xs">Basic commands still work: "Create a red circle", "Add text", "Make a 2x2 grid"</div>
                      {recognition && <div className="text-blue-600">💬 Voice input supported!</div>}
                    </div>
                  )}
                </div>

                {/* Keyboard Shortcuts */}
                <div>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
                    ⌨️ Keyboard Shortcuts
                  </h3>
                  <div className="space-y-3 text-xs" style={{ color: colors.textMuted }}>
                    <div>
                      <div className="font-medium mb-2" style={{ color: colors.text }}>Selection:</div>
                      <div className="space-y-1">
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+A</kbd> Select all shapes</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Escape</kbd> Deselect all</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Shift+Click</kbd> Multi-select shapes</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium mb-2" style={{ color: colors.text }}>Editing:</div>
                      <div className="space-y-1">
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+C</kbd> Copy selected</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+X</kbd> Cut selected</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+V</kbd> Paste</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+D</kbd> Duplicate selected</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Delete</kbd> Remove selected</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium mb-2" style={{ color: colors.text }}>History:</div>
                      <div className="space-y-1">
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+Z</kbd> Undo last action</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+R</kbd> Redo last undo</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium mb-2" style={{ color: colors.text }}>Movement:</div>
                      <div className="space-y-1">
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Arrow Keys</kbd> Move selection 5px</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Shift+Arrows</kbd> Move selection 25px</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Canvas Features & Tips */}
              <div className="space-y-6">
                
                {/* Canvas Features */}
                <div>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
                    🎨 Canvas Features
                  </h3>
                  <div className="space-y-3 text-xs" style={{ color: colors.textMuted }}>
                    <div>
                      <div className="font-medium mb-2" style={{ color: colors.text }}>Drawing Tools:</div>
                      <div className="space-y-1">
                        <div>• <strong>Shapes:</strong> Rectangle, Circle, Triangle</div>
                        <div>• <strong>Lines & Arrows:</strong> Draw connections and flows</div>
                        <div>• <strong>Text:</strong> Double-click to edit, rich formatting</div>
                        <div>• <strong>Icons:</strong> 10+ common interface icons</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium mb-2" style={{ color: colors.text }}>Canvas Controls:</div>
                      <div className="space-y-1">
                        <div>• <strong>Zoom:</strong> Mouse wheel or trackpad</div>
                        <div>• <strong>Pan:</strong> Drag empty canvas area</div>
                        <div>• <strong>Right-click:</strong> Context menu for shapes</div>
                        <div>• <strong>Layer Order:</strong> Move to front/back via context menu</div>
                        <div>• <strong>Duplicate:</strong> Right-click → Duplicate</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium mb-2" style={{ color: colors.text }}>Themes:</div>
                      <div className="space-y-1">
                        <div>• <strong>Light/Dark:</strong> Automatic or manual</div>
                        <div>• <strong>Halloween Mode:</strong> Spooky theme with FrAInkenstein!</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pro Tips */}
                <div>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
                    💡 Pro Tips
                  </h3>
                  <div className="space-y-2 text-xs" style={{ color: colors.textMuted }}>
                    <div>• <strong>Quick Shapes:</strong> Use AI commands like "Create 5 blue circles in a row"</div>
                    <div>• <strong>Precision:</strong> AI understands exact coordinates: "Move to 100, 200"</div>
                    <div>• <strong>Bulk Operations:</strong> Select multiple shapes, then use AI or shortcuts</div>
                    <div>• <strong>Voice Control:</strong> Great for hands-free design iteration</div>
                    <div>• <strong>Context Menus:</strong> Right-click for quick formatting options</div>
                    <div>• <strong>Auto-save:</strong> Your work is automatically saved</div>
                    <div>• <strong>Multiplayer:</strong> Share your canvas URL for real-time collaboration</div>
                  </div>
                </div>

                {/* Performance */}
                <div>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
                    ⚡ Performance
                  </h3>
                  <div className="space-y-2 text-xs" style={{ color: colors.textMuted }}>
                    <div>• <strong>FPS Counter:</strong> Monitor performance (top ribbon)</div>
                    <div>• <strong>Stress Test:</strong> Test with 500+ shapes (toolbar)</div>
                    <div>• <strong>Optimized:</strong> Handles hundreds of shapes smoothly</div>
                    <div>• <strong>Real-time Sync:</strong> Sub-100ms multiplayer updates</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Grid Overlay Component
function GridOverlay({ canvasSize }: { canvasSize: { width: number; height: number } }) {
  const { colors } = useTheme();
  
  const gridSize = 25; // 25px grid spacing
  const gridColor = colors.textMuted; // Use theme-aware muted text color
  const gridOpacity = 0.3; // Make it subtle
  
  const lines = [];
  
  // Vertical lines
  for (let i = 0; i <= canvasSize.width; i += gridSize) {
    lines.push(
      <Line
        key={`v-${i}`}
        points={[i, 0, i, canvasSize.height]}
        stroke={gridColor}
        strokeWidth={0.5}
        opacity={gridOpacity}
      />
    );
  }
  
  // Horizontal lines  
  for (let i = 0; i <= canvasSize.height; i += gridSize) {
    lines.push(
      <Line
        key={`h-${i}`}
        points={[0, i, canvasSize.width, i]}
        stroke={gridColor}
        strokeWidth={0.5}
        opacity={gridOpacity}
      />
    );
  }
  
  return <>{lines}</>;
}

// TabBar Component for Multi-Canvas Management
function TabBar() {
  const { openTabs, activeTabId, openCanvasInTab, closeTab, switchToTab, hasUnsavedTab } = useCanvas();
  const { colors } = useTheme();

  const handleNewTab = async () => {
    // Temporary disclaimer while database schema issues are resolved
    alert('New Canvas Tab feature is temporarily unavailable due to database schema caching. Please use the current canvas with auto-save for now. Feature coming soon!');
    return;
    
    try {
      const title = prompt('New canvas title:', 'Untitled Canvas') || 'Untitled Canvas';
      const canvasState = useCanvas.getState();
      const newCanvas = await canvasState.createNewCanvas(title.trim());
      
      // Open the new canvas in a tab
      openCanvasInTab(newCanvas);
      
      // Load the canvas to populate shapes if needed
      await canvasState.loadCanvas(newCanvas.id);
    } catch (error) {
      console.error('Canvas creation error:', error);
      
      // More detailed error handling
      if (error instanceof Error) {
        const errorDetails = error as Error;
        alert(`Tab creation failed: ${errorDetails.message}. Please try creating a new canvas from the File menu instead.`);
      } else {
        alert('Unable to create new canvas tab. Please check your connection and try again.');
      }
    }
  };

  const handleTabClick = async (canvasId: string) => {
    if (canvasId === activeTabId) return; // Already active

    try {
      // Switch to the tab
      switchToTab(canvasId);
      
      // Load the canvas shapes
      const canvasState = useCanvas.getState();
      await canvasState.loadCanvas(canvasId);
    } catch (error) {
      alert('Failed to switch to canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCloseTab = async (e: React.MouseEvent, canvasId: string) => {
    e.stopPropagation(); // Prevent tab switch when clicking close
    
    try {
      const canvasState = useCanvas.getState();
      await canvasState.closeTab(canvasId);
    } catch (error) {
      alert('Failed to close tab: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  if (openTabs.length === 0) {
    // No tabs open, show a clean state with just the + button
    return (
      <div 
        className="border-b px-4 py-2 flex items-center"
        style={{ 
          backgroundColor: colors.bgSecondary, 
          borderColor: colors.border 
        }}
      >
        <button
          onClick={handleNewTab}
          className="flex items-center px-3 py-1 text-sm rounded transition-colors"
          style={{
            color: colors.textSecondary,
            backgroundColor: colors.buttonBg
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.text;
            e.currentTarget.style.backgroundColor = colors.buttonHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.textSecondary;
            e.currentTarget.style.backgroundColor = colors.buttonBg;
          }}
          title="New Canvas"
        >
          <span className="text-lg mr-1">+</span>
          New Canvas
        </button>
      </div>
    );
  }

  return (
    <div 
      className="border-b px-4 py-2 flex items-center overflow-x-auto"
      style={{ 
        backgroundColor: colors.bgSecondary, 
        borderColor: colors.border 
      }}
    >
      {/* Canvas Tabs */}
      <div className="flex space-x-1 mr-4">
        {openTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isUnsaved = hasUnsavedTab(tab.id);
          
          return (
            <div
              key={tab.id}
              className="flex items-center px-3 py-1 rounded-t text-sm cursor-pointer transition-colors border-b-2"
              style={{
                backgroundColor: isActive ? colors.bg : colors.buttonBg,
                color: isActive ? colors.text : colors.textSecondary,
                borderBottomColor: isActive ? colors.primary : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = colors.buttonHover;
                  e.currentTarget.style.color = colors.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = colors.buttonBg;
                  e.currentTarget.style.color = colors.textSecondary;
                }
              }}
              onClick={() => handleTabClick(tab.id)}
            >
              <span className="max-w-32 truncate">
                {tab.title}
                {isUnsaved && <span className="text-orange-500 ml-1">•</span>}
              </span>
              
              {/* Close button */}
              <button
                onClick={(e) => handleCloseTab(e, tab.id)}
                className="ml-2 w-4 h-4 flex items-center justify-center rounded-full transition-colors"
                style={{ color: colors.textMuted }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = colors.text;
                  e.currentTarget.style.backgroundColor = colors.buttonHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = colors.textMuted;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Close tab"
              >
                <span className="text-xs">×</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* New Tab Button */}
      <button
        onClick={handleNewTab}
        className="flex items-center px-2 py-1 text-sm rounded transition-colors"
        style={{
          color: colors.textSecondary,
          backgroundColor: colors.buttonBg
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = colors.text;
          e.currentTarget.style.backgroundColor = colors.buttonHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = colors.textSecondary;
          e.currentTarget.style.backgroundColor = colors.buttonBg;
        }}
        title="New Canvas Tab"
      >
        <span className="text-lg">+</span>
      </button>
    </div>
  );
}

// Single channel instance to prevent missed broadcasts
let roomChannel: ReturnType<typeof supabase.channel> | null = null;

// Debounced persistence system
const pending = new Map<string, any>();
let flushTimer: number | null = null;

interface CanvasProps {
  onSignOut: () => void;
}

// Context Menu Types
interface ContextMenuData {
  x: number;
  y: number;
  shapeIds: string[]; // Support multiple shapes for alignment tools
}

export default function Canvas({ onSignOut }: CanvasProps) {
  const { shapes, selectedIds, me, cursors, roomId } = useCanvas();
  const { colors, showGrid } = useTheme();
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const [_scale, setScale] = useState(1);
  const [editingText, setEditingText] = useState<{id: string, x: number, y: number, value: string} | null>(null);
  const [showHelpPopup, setShowHelpPopup] = useState(false);
  const [status, setStatus] = useState<'connecting'|'online'|'reconnecting'|'offline'>('connecting');
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const trRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Initialize with last active canvas on app start
  useEffect(() => {
    const initCanvas = async () => {
      try {
        await useCanvas.getState().initializeCanvas();
      } catch (error) {
        console.error('Failed to initialize canvas on startup:', error);
      }
    };
    
    initCanvas();
  }, []); // Only run once on mount

  // Realtime init with connection status tracking
  useEffect(() => {
    const roomId = useCanvas.getState().roomId;
    const channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: useCanvas.getState().me.id } } });
    
    // Set global channel reference
    roomChannel = channel;

    channel.on("broadcast", { event: "shape:upsert" }, ({ payload }) => {
      useCanvas.getState().upsert(payload as ShapeBase | ShapeBase[]);
    });
    channel.on("broadcast", { event: "shape:remove" }, ({ payload }) => {
      useCanvas.getState().remove(payload as string[]);
    });

    channel.on("presence", { event: "sync" }, () => {
      const presenceState = channel.presenceState();
      const users = Object.keys(presenceState);
      useCanvas.getState().setOnlineUsers(users);
      
      // Update cursors from presence data
      Object.entries(presenceState).forEach(([userId, presence]) => {
        if (userId !== me.id && presence.length > 0) {
          const presenceData = presence[0] as any;
          if (presenceData.x !== undefined && presenceData.y !== undefined) {
            useCanvas.getState().updateCursor({
              id: userId,
              name: presenceData.name || 'Guest',
              x: presenceData.x,
              y: presenceData.y,
              color: presenceData.color || '#666',
              last: presenceData.last || Date.now()
            });
          }
        }
      });
    });

    channel.on("presence", { event: "join" }, ({ key }) => {
      console.log('User joined:', key);
    });

    channel.on("presence", { event: "leave" }, ({ key }) => {
      console.log('User left:', key);
      useCanvas.getState().removeCursor(key);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setStatus('online');
        const { me } = useCanvas.getState();
        channel.track({ id: me.id, name: me.name || "Guest", x: 0, y: 0, color: me.color, last: Date.now() });
        // Load persisted shapes
        const { data, error } = await supabase.from("shapes").select("*").eq("room_id", useCanvas.getState().roomId);
        if (error) {
          console.error("Failed to load shapes from database:", error);
        } else if (data) {
          const mapped = data.map((r: any) => ({
            id: r.id,
            type: r.type,
            x: r.x,
            y: r.y,
            w: r.w,
            h: r.h,
            rotation: r.rotation || 0,
            color: r.color,
            stroke: r.stroke,
            strokeWidth: r.strokeWidth,
            zIndex: r.zIndex || 0,
            text: r.text,
            fontSize: r.fontSize,
            fontFamily: r.fontFamily,
            textAlign: r.textAlign,
            fontStyle: r.fontStyle,
            fontWeight: r.fontWeight,
            textDecoration: r.textDecoration,
            imageUrl: r.imageUrl,
            originalWidth: r.originalWidth,
            originalHeight: r.originalHeight,
            x2: r.x2,
            y2: r.y2,
            arrowHead: r.arrowHead,
            dashPattern: r.dashPattern,
            updated_at: r.updated_at,
            updated_by: r.updated_by
          }));
          console.log(`Loaded ${mapped.length} shapes from database for room: ${useCanvas.getState().roomId}`);
          useCanvas.getState().upsert(mapped as any);
        }
      }
    });

    // Connection status monitoring - simplified for deployment
    // TODO: Re-implement when Supabase realtime status API is available
    setStatus('online'); // Assume online for now

    return () => { 
      channel.unsubscribe(); 
      roomChannel = null;
    };
  }, []);

  // Global mouse event listeners to handle panning outside canvas bounds
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Reset panning state when mouse is released anywhere
      if (canvasStageRef.current) {
        const stage = canvasStageRef.current;
        stage.startPointerPos = null;
        stage.startPos = null;
      }
    };

    // Add global mouse up listener
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseUp); // Also handle when mouse leaves the page

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, []);

  // Canvas sizing effect
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasContainerRef.current) {
        const container = canvasContainerRef.current;
        const rect = container.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    // Initial size calculation
    updateCanvasSize();

    // Update on window resize
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // Wheel zoom
  const onWheel = (e:any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = canvasStageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const direction = e.evt.deltaY > 0 ? -1 : 1; // Flipped: wheel up = zoom in
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Apply zoom with bounds
    const minScale = 0.1;
    const maxScale = 5;
    const boundedScale = Math.max(minScale, Math.min(maxScale, newScale));
    
    setScale(boundedScale);
    stage.scale({ x: boundedScale, y: boundedScale });
    const newPos = { x: pointer.x - mousePointTo.x * boundedScale, y: pointer.y - mousePointTo.y * boundedScale };
    stage.position(newPos);
    stage.batchDraw();
  };

  // Cursor broadcast
  useEffect(() => {
    let raf:number|undefined;
    const handler = (e:MouseEvent) => {
      if (raf) cancelAnimationFrame(raf as number);
      raf = requestAnimationFrame(() => {
        const channel = supabase.channel(`room:${useCanvas.getState().roomId}`);
        const { me } = useCanvas.getState();
        channel.track({ id: me.id, name: me.name || "Guest", x: e.clientX, y: e.clientY, color: me.color, last: Date.now() });
      });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Comprehensive Keyboard Shortcuts System
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts while editing text
      if (editingText) return;
      
      // Don't handle shortcuts when user is typing in input fields
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      )) {
        return;
      }
      
      // === HISTORY & EDITING ===
      
      // Undo with Ctrl+Z
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        useCanvas.getState().undo();
        e.preventDefault();
        return;
      }
      
      // Redo with Ctrl+R
      if (e.ctrlKey && e.key === 'r') {
        useCanvas.getState().redo();
        e.preventDefault();
        return;
      }
      
      // Duplicate selected shapes with Ctrl+D
      if (e.ctrlKey && e.key === 'd') {
        const selectedIds = useCanvas.getState().selectedIds;
        if (selectedIds.length > 0) {
          // Save history before duplicating
          useCanvas.getState().pushHistory();
          
          // Duplicate shapes (this also selects the new shapes)
          useCanvas.getState().duplicateShapes(selectedIds);
          
          // Get the newly created shapes to broadcast them
          const newShapes = useCanvas.getState().getSelectedShapes();
          
          // Broadcast new shapes to other users
          broadcastUpsert(newShapes);
          
          // Persist to database
          newShapes.forEach(shape => persist(shape));
          
          e.preventDefault();
        }
        return;
      }
      
      // Delete selected shapes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedIds = useCanvas.getState().selectedIds;
        if (selectedIds.length > 0) {
          // Save history before deleting
          useCanvas.getState().pushHistory();
          
          // Remove from store
          useCanvas.getState().remove(selectedIds);
          
          // Broadcast removal to other users
          broadcastRemove(selectedIds);
          
          // Remove from database
          deleteFromDB(selectedIds);
          
          e.preventDefault(); // Prevent browser back navigation
        }
        return;
      }
      
      // === SELECTION ===
      
      // Select All with Ctrl+A
      if (e.ctrlKey && e.key === 'a') {
        const allShapeIds = Object.keys(useCanvas.getState().shapes);
        useCanvas.getState().select(allShapeIds);
        e.preventDefault();
        return;
      }
      
      // Deselect All with Escape
      if (e.key === 'Escape') {
        useCanvas.getState().select([]);
        e.preventDefault();
        return;
      }
      
      // === COPY & PASTE ===
      
      // Copy with Ctrl+C
      if (e.ctrlKey && e.key === 'c') {
        const selectedIds = useCanvas.getState().selectedIds;
        if (selectedIds.length > 0) {
          const selectedShapes = useCanvas.getState().getSelectedShapes();
          // Store in a global variable for paste functionality
          (window as any).collabCanvasClipboard = selectedShapes;
          
          // Optional: Show feedback to user
          console.log(`Copied ${selectedShapes.length} shape${selectedShapes.length > 1 ? 's' : ''} to clipboard`);
          
          e.preventDefault();
        }
        return;
      }
      
      // Cut with Ctrl+X
      if (e.ctrlKey && e.key === 'x') {
        const selectedIds = useCanvas.getState().selectedIds;
        if (selectedIds.length > 0) {
          const selectedShapes = useCanvas.getState().getSelectedShapes();
          
          // First copy to clipboard
          (window as any).collabCanvasClipboard = selectedShapes;
          
          // Then delete the shapes
          // Save history before deleting
          useCanvas.getState().pushHistory();
          
          // Remove from store
          useCanvas.getState().remove(selectedIds);
          
          // Broadcast removal to other users
          broadcastRemove(selectedIds);
          
          // Remove from database
          deleteFromDB(selectedIds);
          
          // Show feedback to user
          console.log(`Cut ${selectedShapes.length} shape${selectedShapes.length > 1 ? 's' : ''} to clipboard`);
          
          e.preventDefault();
        }
        return;
      }
      
      // Paste with Ctrl+V
      if (e.ctrlKey && e.key === 'v') {
        const clipboard = (window as any).collabCanvasClipboard;
        if (clipboard && Array.isArray(clipboard)) {
          // Save history before pasting
          useCanvas.getState().pushHistory();
          
          // Clear current selection
          useCanvas.getState().select([]);
          
          const newShapeIds: string[] = [];
          
          // Create new shapes with offset positioning
          clipboard.forEach((originalShape: ShapeBase, index: number) => {
            const offsetX = 20 + (index * 5); // Slight cascade effect
            const offsetY = 20 + (index * 5);
            
            const newShape = {
              ...originalShape,
              id: Math.random().toString(36).substring(2),
              x: originalShape.x + offsetX,
              y: originalShape.y + offsetY,
              // Also offset end points for lines/arrows
              ...(originalShape.x2 !== undefined && { x2: originalShape.x2 + offsetX }),
              ...(originalShape.y2 !== undefined && { y2: originalShape.y2 + offsetY }),
              updated_at: Date.now(),
              updated_by: useCanvas.getState().me.id,
            };
            
            useCanvas.getState().upsert(newShape);
            newShapeIds.push(newShape.id);
            
            // Broadcast and persist
            broadcastUpsert(newShape);
            persist(newShape);
          });
          
          // Select the newly pasted shapes
          useCanvas.getState().select(newShapeIds);
          
          console.log(`Pasted ${newShapeIds.length} shape${newShapeIds.length > 1 ? 's' : ''}`);
          e.preventDefault();
        }
        return;
      }
      
      // === MOVEMENT ===
      
      // Arrow key movement
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const selectedIds = useCanvas.getState().selectedIds;
        if (selectedIds.length > 0) {
          // Save history before moving
          useCanvas.getState().pushHistory();
          
          // Determine movement distance (Shift = large, normal = small)
          const moveDistance = e.shiftKey ? 25 : 5;
          
          // Calculate movement delta
          let dx = 0, dy = 0;
          switch (e.key) {
            case 'ArrowUp': dy = -moveDistance; break;
            case 'ArrowDown': dy = moveDistance; break;
            case 'ArrowLeft': dx = -moveDistance; break;
            case 'ArrowRight': dx = moveDistance; break;
          }
          
          // Move each selected shape
          selectedIds.forEach(id => {
    const shape = useCanvas.getState().shapes[id];
            if (shape) {
              const updatedShape = {
                ...shape,
                x: shape.x + dx,
                y: shape.y + dy,
                // Also move end points for lines/arrows
                ...(shape.x2 !== undefined && { x2: shape.x2 + dx }),
                ...(shape.y2 !== undefined && { y2: shape.y2 + dy }),
                updated_at: Date.now(),
                updated_by: useCanvas.getState().me.id,
              };
              
              useCanvas.getState().upsert(updatedShape);
              broadcastUpsert(updatedShape);
              persist(updatedShape);
            }
          });
          
          e.preventDefault();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingText]);


  // Text editing

  const finishTextEdit = (save: boolean = true) => {
    if (editingText && save) {
      const shape = useCanvas.getState().shapes[editingText.id];
      if (shape) {
        // Save history before updating
        useCanvas.getState().pushHistory();
        
        // Calculate new dimensions for the updated text
        const fontSize = shape.fontSize || Math.max(16, Math.min(24, shape.h * 0.6));
        const dimensions = getTextDimensions(editingText.value, fontSize);
        
        const updatedShape = {
          ...shape,
          text: editingText.value,
          w: dimensions.width,
          h: dimensions.height,
          fontSize: fontSize,
          updated_at: Date.now(),
          updated_by: me.id
        };
        
        useCanvas.getState().upsert(updatedShape);
        broadcastUpsert(updatedShape);
        persist(updatedShape);
      }
    }
    setEditingText(null);
  };

  // Selection clearing for clicks outside the main canvas area
  const onStageClick = (e:any) => {
    // Clear selection if clicking on background areas
    const isStage = e.target === e.target.getStage();
    const isBackgroundRect = e.target.attrs && e.target.attrs.fill === '#fafafa';
    const isNotShape = !e.target.parent || !e.target.parent.attrs || !e.target.parent.attrs.id;
    
    // Close context menu on any click
    setContextMenu(null);
    
    if (isStage || isBackgroundRect || isNotShape) {
      useCanvas.getState().select([]);
    }
  };

  // Pan functionality
  const onStageMouseDown = (e:any) => {
    // Setup panning if clicking on background areas
    const clickedOnEmpty = e.target === e.target.getStage();
    const clickedOnBackground = e.target.attrs && e.target.attrs.fill === '#fafafa';
    
    if (clickedOnEmpty || clickedOnBackground) {
      const stage = canvasStageRef.current;
      stage.startPointerPos = stage.getPointerPosition();
      stage.startPos = { x: stage.x(), y: stage.y() };
    }
  };

  const onStageMouseMove = (_e:any) => {
    const stage = canvasStageRef.current;
    if (!stage.startPointerPos) return;
    
    const currentPos = stage.getPointerPosition();
    const dx = currentPos.x - stage.startPointerPos.x;
    const dy = currentPos.y - stage.startPointerPos.y;
    
    stage.position({
      x: stage.startPos.x + dx,
      y: stage.startPos.y + dy,
    });
  };

  const onStageMouseUp = () => {
    const stage = canvasStageRef.current;
    stage.startPointerPos = null;
    stage.startPos = null;
  };

  const onDragEnd = (id:string, e:any) => {
    // Save history before moving
    useCanvas.getState().pushHistory();
    
    const node = e.target;
    const next = { ...useCanvas.getState().shapes[id], x: node.x(), y: node.y(), updated_at: Date.now(), updated_by: me.id } as ShapeBase;
    useCanvas.getState().upsert(next); broadcastUpsert(next); persist(next);
  };

  const onTransformEnd = () => {
    const ids = useCanvas.getState().selectedIds;
    if (!ids.length) return;
    
    // Save history before transforming
    useCanvas.getState().pushHistory();
    
    const node = trRef.current.nodes()[0];
    const prev = useCanvas.getState().shapes[ids[0]];
    const scaleX = node.scaleX(); const scaleY = node.scaleY();
    const next: ShapeBase = {
      ...prev,
      x: node.x(), y: node.y(),
      w: Math.max(10, prev.w * scaleX),
      h: Math.max(10, prev.h * scaleY),
      rotation: node.rotation(),
      updated_at: Date.now(),
      updated_by: me.id
    };
    node.scaleX(1); node.scaleY(1);
    useCanvas.getState().upsert(next); broadcastUpsert(next); persist(next);
  };

  React.useEffect(() => {
    if (trRef.current) {
      if (selectedIds.length) {
        // Show transformer for all selected shapes
        const nodes = selectedIds.map(id => layerRef.current.find(`#${id}`)).flat().filter(Boolean);
        trRef.current.nodes(nodes);
      } else {
        // Clear transformer when no selection
        trRef.current.nodes([]);
      }
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedIds, shapes]);

  // Helper function to calculate dynamic text dimensions
  const getTextDimensions = (text: string, fontSize: number) => {
    // Estimate character width (roughly 0.6 * fontSize for most fonts)
    const charWidth = fontSize * 0.6;
    const words = text.split(' ');
    const maxLineWidth = Math.max(300, Math.min(800, words.length > 1 ? 400 : text.length * charWidth));
    
    // Calculate how many lines we need
    let currentLineWidth = 0;
    let lines = 1;
    
    for (const word of words) {
      const wordWidth = word.length * charWidth + charWidth; // +space
      if (currentLineWidth + wordWidth > maxLineWidth && currentLineWidth > 0) {
        lines++;
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += wordWidth;
      }
    }
    
    const width = Math.min(maxLineWidth, text.length * charWidth);
    const height = lines * fontSize * 1.4; // 1.4 for line height
    
    return { width: Math.max(width, 80), height: Math.max(height, fontSize * 1.2) };
  };


  // Shape elements with right-click support and styling - sorted by zIndex for layer ordering
  const shapeEls = useMemo(() => Object.values(shapes)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((s: ShapeBase) => {
    // For text shapes, calculate dynamic dimensions
    let textWidth = s.w;
    let textHeight = s.h;
    let fontSize = s.fontSize || Math.max(16, Math.min(24, s.h * 0.6));
    
    if (s.type === 'text' && s.text) {
      const dims = getTextDimensions(s.text, fontSize);
      textWidth = dims.width;
      textHeight = dims.height;
    }
    const onClick = (e: any) => {
      e.cancelBubble = true; // Prevent event from bubbling to stage
      if (e.evt.shiftKey) {
        const currentSelection = useCanvas.getState().selectedIds;
        if (currentSelection.includes(s.id)) {
          // Remove from selection if already selected
          const newSelection = currentSelection.filter(id => id !== s.id);
          useCanvas.getState().select(newSelection);
        } else {
          // Add to selection
          const newSelection = [...currentSelection, s.id];
          useCanvas.getState().select(newSelection);
        }
      } else {
        // Single selection
        if (selectedIds.includes(s.id)) {
          if (selectedIds.length === 1) {
            useCanvas.getState().select([]);
          }
        } else {
          useCanvas.getState().select([s.id]);
        }
      }
    };

    const onRightClick = (e: any) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      // Determine which shapes to include in context menu
      const currentSelectedIds = useCanvas.getState().selectedIds;
      let contextShapeIds: string[];
      
      if (currentSelectedIds.includes(s.id) && currentSelectedIds.length > 1) {
        // Right-clicked on a shape that's part of a multi-selection
        contextShapeIds = currentSelectedIds;
      } else {
        // Right-clicked on unselected shape or single selection
        contextShapeIds = [s.id];
        // Select the shape when right-clicking if not already selected
        if (!currentSelectedIds.includes(s.id)) {
          useCanvas.getState().select([s.id]);
        }
      }
      
      setContextMenu({
        x: pointer.x,
        y: pointer.y,
        shapeIds: contextShapeIds
      });
    };
    
    return (
      <Group 
        key={s.id}
        id={s.id}
        x={s.x}
        y={s.y}
        onTap={onClick} 
        onClick={onClick} 
        onContextMenu={onRightClick}
        draggable={true}
        onDragEnd={(e) => onDragEnd(s.id, e)}
      >
        {s.type === "rect" && (
            <Rect 
            x={0}
            y={0}
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "circle" && (
          <Circle
            x={s.w / 2}
            y={s.h / 2}
            radius={Math.min(s.w, s.h) / 2}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "text" && (
          <>
            <KText 
              x={0}
              y={0}
              text={s.text || "Text"}
              fontSize={fontSize} 
              fontFamily={`${s.fontStyle === 'italic' ? 'italic ' : ''}${s.fontWeight === 'bold' ? 'bold ' : ''}${s.fontFamily || "Arial"}`}
              fill={s.color || "#111"} 
              stroke={s.stroke}
              strokeWidth={s.strokeWidth || 0}
              width={textWidth}
              height={textHeight}
              wrap="word"
              ellipsis={false}
              align={isEmoji(s.text || "") ? "center" : (s.textAlign || "left")}
              verticalAlign={isEmoji(s.text || "") ? "middle" : "top"}
              onDblClick={() => {
                setEditingText({ id: s.id, x: s.x, y: s.y, value: s.text || '' });
              }}
            />
            
            {/* Underline decoration (since Konva Text doesn't support textDecoration directly) */}
            {s.textDecoration === 'underline' && (
              <Line 
                points={[0, textHeight - 2, textWidth, textHeight - 2]}
                stroke={s.color || "#111"}
                strokeWidth={Math.max(1, fontSize * 0.05)}
              />
            )}
          </>
        )}
        {s.type === "image" && s.imageUrl && (
          <ImageShape
            imageUrl={s.imageUrl}
            width={s.w}
            height={s.h}
            stroke={s.stroke}
            strokeWidth={s.strokeWidth}
          />
        )}
        {s.type === "triangle" && (
          <TriangleShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "star" && (
          <StarShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "heart" && (
          <HeartShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "pentagon" && (
          <PentagonShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "hexagon" && (
          <HexagonShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "octagon" && (
          <OctagonShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "oval" && (
          <Circle
            x={s.w / 2}
            y={s.h / 2}
            radiusX={s.w / 2}
            radiusY={s.h / 2}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "trapezoid" && (
          <TrapezoidShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "rhombus" && (
          <RhombusShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "parallelogram" && (
          <ParallelogramShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "line" && (
          <>
            {/* Invisible hit area for easier selection */}
            <Line
              points={[0, 0, s.x2! - s.x, s.y2! - s.y]}
              stroke="transparent"
              strokeWidth={Math.max(10, (s.strokeWidth || 1) + 8)} // At least 10px hit area
              lineCap="round"
              lineJoin="round"
            />
            {/* Actual visible line */}
            <LineShape
              x1={0}
              y1={0}
              x2={s.x2! - s.x}
              y2={s.y2! - s.y}
              stroke={s.stroke || "#000"}
              strokeWidth={s.strokeWidth || 1}
              dash={s.dashPattern}
            />
          </>
        )}
        {s.type === "arrow" && (
          <>
            {/* Invisible hit area for easier selection */}
            <Line
              points={[0, 0, s.x2! - s.x, s.y2! - s.y]}
              stroke="transparent"
              strokeWidth={Math.max(10, (s.strokeWidth || 1) + 8)} // At least 10px hit area
              lineCap="round"
              lineJoin="round"
            />
            {/* Actual visible arrow */}
            <ArrowShape
              x1={0}
              y1={0}
              x2={s.x2! - s.x}
              y2={s.y2! - s.y}
              stroke={s.stroke || "#000"}
              strokeWidth={s.strokeWidth || 1}
              dash={s.dashPattern}
              arrowHead={s.arrowHead || "end"}
            />
          </>
        )}
      </Group>
    );
  }), [shapes, selectedIds]);

  const canvasStageRef = useRef<any>(null);

  return (
    <div 
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: colors.bgSecondary }}
    >
      {/* Layout fix v2: Force cache refresh for production deployment */}
      <TopRibbon onSignOut={onSignOut} stageRef={canvasStageRef} setShowHelpPopup={setShowHelpPopup} />
      <TabBar />
      <div className="flex-1 flex min-h-0">
        <Toolbar onSignOut={onSignOut} status={status} />
        <div 
          ref={canvasContainerRef} 
          className="flex-1 relative overflow-hidden"
          style={{ backgroundColor: colors.canvasBg }}
        >
        <Stage 
            ref={canvasStageRef}
            width={canvasSize.width} 
            height={canvasSize.height} 
          onWheel={onWheel}
          onClick={onStageClick}
          onMouseDown={onStageMouseDown}
          onMouseMove={onStageMouseMove}
          onMouseUp={onStageMouseUp}
        >
          <Layer ref={layerRef}>
            <Rect 
              x={-2000} 
              y={-2000} 
              width={6000} 
              height={6000} 
              fill="#fafafa"
              onClick={() => useCanvas.getState().select([])}
              onTap={() => useCanvas.getState().select([])}
            />
            
            {/* Grid Overlay */}
            {showGrid && <GridOverlay canvasSize={canvasSize} />}
            {shapeEls}
            <Transformer ref={trRef} rotateEnabled={true} onTransformEnd={onTransformEnd} />
          </Layer>
        </Stage>
        
        {/* Text editing overlay */}
        {editingText && (
          <input
            type="text"
            value={editingText.value}
            onChange={(e) => setEditingText({...editingText, value: e.target.value})}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                finishTextEdit(true);
              } else if (e.key === 'Escape') {
                finishTextEdit(false);
              }
            }}
            onBlur={() => finishTextEdit(true)}
            autoFocus
            className="absolute bg-white border-2 border-blue-500 px-2 py-1 text-sm font-mono z-50"
            style={{
              left: editingText.x,
              top: editingText.y,
              minWidth: '100px'
            }}
          />
        )}
        
        {/* Multiplayer cursors */}
        {Object.values(cursors).filter(cursor => cursor.id !== me.id).map((cursor) => (
          <div
            key={cursor.id}
            className="absolute pointer-events-none z-40 transition-all duration-75"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(-2px, -2px)'
            }}
          >
            {/* Cursor arrow */}
            <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-sm">
              <path
                d="M5.65 2.22a1 1 0 011.1-.13l14 7a1 1 0 01.13 1.77l-5.88 3.53 3.53 5.88a1 1 0 01-1.77.13l-7-14a1 1 0 01.13-1.1z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* User name label */}
            <div
              className="absolute top-6 left-2 px-2 py-1 rounded text-xs font-medium text-white shadow-lg whitespace-nowrap"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.name}
            </div>
          </div>
        ))}
        
        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu 
            x={contextMenu.x}
            y={contextMenu.y}
            shapeIds={contextMenu.shapeIds}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
      </div>
      
      {/* Floating AI Agent Widget - Bottom Right */}
      <FloatingAIWidget />
      
      {/* Help Popup */}
      <HelpPopup isOpen={showHelpPopup} onClose={() => setShowHelpPopup(false)} />
    </div>
  );
}

interface ToolbarProps {
  onSignOut: () => void;
  status: 'connecting'|'online'|'reconnecting'|'offline';
}

function CategorizedToolbar() {
  const { colors } = useTheme();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['lines-arrows', 'shapes', 'emojis']) // Start with lines-arrows, shapes and emojis expanded
  );
  
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const addRect = () => addShape("rect", colors);
  const addCircle = () => addShape("circle", colors);
  const addText = () => addShape("text", colors);
  const addTriangle = () => addShape("triangle", colors);
  const addStar = () => addShape("star", colors);
  const addHeart = () => addShape("heart", colors);
  const addPentagon = () => addShape("pentagon", colors);
  const addHexagon = () => addShape("hexagon", colors);
  const addOctagon = () => addShape("octagon", colors);
  const addOval = () => addShape("oval", colors);
  const addTrapezoid = () => addShape("trapezoid", colors);
  const addRhombus = () => addShape("rhombus", colors);
  const addParallelogram = () => addShape("parallelogram", colors);
  
  // Line and arrow creation functions
  const addLine = () => addShape("line", colors);
  const addArrow = () => addShape("arrow", colors);
  
  const addEmoji = (emoji: string) => {
    // Save history before creating
    useCanvas.getState().pushHistory();
    
    const { me, shapes } = useCanvas.getState();
    
    // Convert emoji to Twemoji image URL
    const emojiCodePoint = emoji.codePointAt(0)?.toString(16);
    if (!emojiCodePoint) return;
    
    // Twemoji CDN URL (Twitter's emoji images)
    const twemojiUrl = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${emojiCodePoint}.png`;
    
    // Emoji size - much better for resizing as images
    const size = 48; // Good default size for emoji images
    const position = findBlankArea(shapes, size, size);
    
    const emojiShape: ShapeBase = { 
      id: crypto.randomUUID(), 
      type: "image", 
      x: position.x, 
      y: position.y, 
      w: size, 
      h: size, 
      imageUrl: twemojiUrl,
      originalWidth: 72, // Twemoji standard size
      originalHeight: 72,
      updated_at: Date.now(), 
      updated_by: me.id 
    };
    
    useCanvas.getState().upsert(emojiShape); 
    broadcastUpsert(emojiShape); 
    persist(emojiShape);
    
    // Auto-select the new emoji
    useCanvas.getState().select([emojiShape.id]);
  };

  const addIcon = (icon: string) => {
    // Save history before creating
    useCanvas.getState().pushHistory();
    
    const { me, shapes } = useCanvas.getState();
    
    // Convert icon to Twemoji image URL
    const iconCodePoint = icon.codePointAt(0)?.toString(16);
    if (!iconCodePoint) return;
    
    // Twemoji CDN URL (Twitter's emoji images)
    const twemojiUrl = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${iconCodePoint}.png`;
    
    // Icon size - good default for functional icons
    const size = 48; 
    const position = findBlankArea(shapes, size, size);
    
    const iconShape: ShapeBase = { 
      id: crypto.randomUUID(), 
      type: "image", 
      x: position.x, 
      y: position.y, 
      w: size, 
      h: size, 
      imageUrl: twemojiUrl,
      originalWidth: 72, // Twemoji standard size
      originalHeight: 72,
      updated_at: Date.now(), 
      updated_by: me.id 
    };
    
    useCanvas.getState().upsert(iconShape); 
    broadcastUpsert(iconShape); 
    persist(iconShape);
    
    // Auto-select the new icon
    useCanvas.getState().select([iconShape.id]);
  };

  const toolCategories = [
    {
      id: 'lines-arrows',
      name: 'Lines & Arrows',
      emoji: '📏',
      tools: [
        { name: '─', action: addLine, available: true, tooltip: 'Line' },
        { name: '→', action: addArrow, available: true, tooltip: 'Arrow' },
      ]
    },
    {
      id: 'shapes',
      name: 'Shapes',
      emoji: '🔷',
      tools: [
        { name: '▭', action: addRect, available: true, tooltip: 'Rectangle' },
        { name: '●', action: addCircle, available: true, tooltip: 'Circle' },
        { name: '▲', action: addTriangle, available: true, tooltip: 'Triangle' },
        { name: '★', action: addStar, available: true, tooltip: 'Star' },
        { name: '♥', action: addHeart, available: true, tooltip: 'Heart' },
        { name: '⬟', action: addPentagon, available: true, tooltip: 'Pentagon' },
        { name: '⬡', action: addHexagon, available: true, tooltip: 'Hexagon' },
        { name: '⯃', action: addOctagon, available: true, tooltip: 'Octagon' },
        { name: '⬯', action: addOval, available: true, tooltip: 'Oval' },
        { name: '⯊', action: addTrapezoid, available: true, tooltip: 'Trapezoid' },
        { name: '◆', action: addRhombus, available: true, tooltip: 'Rhombus' },
        { name: '▱', action: addParallelogram, available: true, tooltip: 'Parallelogram' },
      ]
    },
    {
      id: 'emojis',
      name: 'Emojis',
      emoji: '😊',
      tools: [
        { name: '😊', action: () => addEmoji('😊'), available: true, tooltip: 'Smiley Face' },
        { name: '❤️', action: () => addEmoji('❤️'), available: true, tooltip: 'Heart' },
        { name: '👍', action: () => addEmoji('👍'), available: true, tooltip: 'Thumbs Up' },
        { name: '🔥', action: () => addEmoji('🔥'), available: true, tooltip: 'Fire' },
        { name: '💡', action: () => addEmoji('💡'), available: true, tooltip: 'Light Bulb' },
        { name: '⚡', action: () => addEmoji('⚡'), available: true, tooltip: 'Lightning' },
        { name: '🎯', action: () => addEmoji('🎯'), available: true, tooltip: 'Target' },
        { name: '🚀', action: () => addEmoji('🚀'), available: true, tooltip: 'Rocket' },
        { name: '⭐', action: () => addEmoji('⭐'), available: true, tooltip: 'Star' },
        { name: '🎉', action: () => addEmoji('🎉'), available: true, tooltip: 'Party' },
        { name: '💻', action: () => addEmoji('💻'), available: true, tooltip: 'Computer' },
        { name: '📱', action: () => addEmoji('📱'), available: true, tooltip: 'Phone' },
      ]
    },
    {
      id: 'icons',
      name: 'Icons',
      emoji: '🔧',
      tools: [
        { name: '⚙️', action: () => addIcon('⚙️'), available: true, tooltip: 'Settings' },
        { name: '🏠', action: () => addIcon('🏠'), available: true, tooltip: 'Home' },
        { name: '📧', action: () => addIcon('📧'), available: true, tooltip: 'Email' },
        { name: '📞', action: () => addIcon('📞'), available: true, tooltip: 'Phone' },
        { name: '🔒', action: () => addIcon('🔒'), available: true, tooltip: 'Lock' },
        { name: '🔍', action: () => addIcon('🔍'), available: true, tooltip: 'Search' },
        { name: '💾', action: () => addIcon('💾'), available: true, tooltip: 'Save' },
        { name: '📁', action: () => addIcon('📁'), available: true, tooltip: 'Folder' },
        { name: '🔗', action: () => addIcon('🔗'), available: true, tooltip: 'Link' },
        { name: '⚡', action: () => addIcon('⚡'), available: true, tooltip: 'Power' },
      ]
    },
    {
      id: 'forms',
      name: 'Forms',
      emoji: '📝',
      tools: [
        // Coming soon via AI commands
      ]
    },
    {
      id: 'assets',
      name: 'Assets',
      emoji: '🎯',
      tools: [
        { name: '📝', action: addText, available: true, tooltip: 'Text Box' },
        // More coming soon
      ]
    }
  ];
  
  return (
    <div className="border-t pt-3">
      <div className="space-y-2">
        {toolCategories.map((category) => (
          <div key={category.id} className="border rounded-lg">
        <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{category.emoji}</span>
                <span className="font-medium text-sm">{category.name}</span>
              </div>
              <span className="text-gray-400 text-xs">
                {expandedCategories.has(category.id) ? '▼' : '▶'}
              </span>
            </button>
            
            {expandedCategories.has(category.id) && (
              <div 
                className="px-3 pb-3 border-t" 
                style={{ 
                  backgroundColor: colors.bgSecondary, 
                  borderColor: colors.border 
                }}
              >
                {category.tools.length === 0 ? (
                  <div className="text-xs text-gray-500 py-2 italic">Coming soon...</div>
                ) : (
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {category.tools.map((tool, idx) => (
                      <button
                        key={idx}
                        onClick={tool.available ? tool.action : undefined}
                        disabled={!tool.available}
                        title={tool.tooltip || (tool.available ? `Create ${tool.name}` : 'Coming soon')}
                        className={`
                          px-2 py-1 text-sm rounded transition-colors flex items-center justify-center min-h-[32px] border
                          ${tool.available 
                            ? 'hover:opacity-80' 
                            : 'opacity-50 cursor-not-allowed'
                          }
                        `}
                        style={{
                          backgroundColor: tool.available ? colors.buttonBg : colors.bgTertiary,
                          color: tool.available ? colors.text : colors.textMuted,
                          borderColor: colors.border
                        }}
                      >
                        {tool.name}
        </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Stress Test Button for Demos */}
      <div 
        className="mt-4 border-t pt-3"
        style={{ borderColor: colors.border }}
      >
        <button 
          className="px-3 py-2 rounded transition-colors text-sm font-medium w-full border"
          style={{
            backgroundColor: colors.buttonBg,
            color: colors.text,
            borderColor: colors.border,
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.buttonBg}
          onClick={() => {
            const { me } = useCanvas.getState();
            const batch: ShapeBase[] = [];
            for (let i = 0; i < 500; i++) {
              batch.push({ 
                id: crypto.randomUUID(), 
                type: "rect", 
                x: 50 + (i % 25) * 90, 
                y: 80 + Math.floor(i / 25) * 60, 
                w: 80, 
                h: 40, 
                color: "#e5e7eb", 
                updated_at: Date.now(), 
                updated_by: me.id 
              });
            }
            useCanvas.getState().upsert(batch); 
            broadcastUpsert(batch); 
            persist(batch);
          }}
          title="Create 500 shapes for stress testing"
        >
          🧪 +500 Stress Test
        </button>
      </div>
    </div>
  );
}

function Toolbar({ onSignOut, status }: ToolbarProps) {
  const { me, onlineUsers, cursors, roomId } = useCanvas();
  const { colors } = useTheme();
  
  // Clear selection when clicking on sidebar background (not on interactive elements)
  const handleSidebarClick = (e: React.MouseEvent) => {
    // Only clear selection if clicking directly on the sidebar background,
    // not on buttons, scrollable areas, or other interactive elements
    if (e.target === e.currentTarget) {
    useCanvas.getState().select([]);
    }
  };
  
  return (
    <div 
      className="w-64 p-4 border-r space-y-3 overflow-y-auto" 
      style={{ 
        backgroundColor: colors.bg, 
        borderColor: colors.border,
        color: colors.text 
      }}
      onClick={handleSidebarClick}
    >
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">CollabCanvas</div>
      </div>
      <div className="text-sm">Signed in as <span style={{color: me.color}}>{me.name||"Guest"}</span></div>
      
      {/* Online users */}
      {onlineUsers.length > 0 && (
        <div className="border-t pt-3">
          <div className="text-sm font-medium mb-2">Online ({onlineUsers.length + 1})</div>
          <div className="space-y-1">
            {/* Current user */}
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: me.color}}></div>
              <span>{me.name || "Guest"} (you)</span>
            </div>
            {/* Other users */}
            {onlineUsers.filter(userId => userId !== me.id).map(userId => {
              const cursor = cursors[userId];
              return (
                <div key={userId} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: cursor?.color || '#666'}}></div>
                  <span>{cursor?.name || 'Guest'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <CategorizedToolbar />
      
      {/* Connection Status Badge */}
      <div className="mt-4 pt-3 border-t">
        <div className="text-xs text-slate-500 space-y-1">
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <span className={`font-medium ${
              status === 'online' ? 'text-green-600' : 
              status === 'connecting' ? 'text-yellow-600' : 
              'text-orange-600'
            }`}>
              {status === 'online' ? '✅ Connected' : 
               status === 'connecting' ? '⏳ Connecting...' : 
               '↻ Reconnecting...'}
            </span>
      </div>
          <div className="flex items-center justify-between">
            <span>Room:</span>
            <span className="font-mono font-medium">{roomId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to detect if text is an emoji
function isEmoji(text: string): boolean {
  // Simple emoji detection: single character that's likely an emoji
  // This catches most emoji cases from our emoji picker
  if (text.length <= 2) {
    // Check if it contains emoji characters (rough detection)
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    return emojiRegex.test(text);
  }
  return false;
}

// Helper function to find a blank area on canvas
function findBlankArea(shapes: Record<string, ShapeBase>, width: number, height: number): { x: number; y: number } {
  const canvasWidth = 1200; // Canvas visible area width
  const canvasHeight = 800; // Canvas visible area height
  const margin = 20; // Minimum distance from other shapes
  const maxAttempts = 50; // Prevent infinite loops
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = margin + Math.random() * (canvasWidth - width - margin * 2);
    const y = margin + Math.random() * (canvasHeight - height - margin * 2);
    
    // Check if this position overlaps with any existing shape
    let hasCollision = false;
    for (const shape of Object.values(shapes)) {
      if (x < shape.x + shape.w + margin &&
          x + width + margin > shape.x &&
          y < shape.y + shape.h + margin &&
          y + height + margin > shape.y) {
        hasCollision = true;
        break;
      }
    }
    
    if (!hasCollision) {
      return { x, y };
    }
  }
  
  // Fallback to random position if no blank area found
  return {
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 200
  };
}

function addShape(type: ShapeType, colors: any) {
  // Save history before creating
  useCanvas.getState().pushHistory();
  
  const { me, shapes } = useCanvas.getState();
  
  let s: ShapeBase;
  if (type === "text") {
    const defaultText = "Hello";
    const fontSize = 20;
    // Calculate initial dimensions based on default text
    const charWidth = fontSize * 0.6;
    const width = Math.max(80, defaultText.length * charWidth);
    const height = fontSize * 1.4;
    
    // Use findBlankArea like other shapes
    const position = findBlankArea(shapes, width, height);
    
    s = { 
      id: crypto.randomUUID(), 
      type, 
      x: position.x, 
      y: position.y, 
      w: width, 
      h: height, 
      color: colors.text, 
      text: defaultText,
      fontSize: fontSize,
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  } else if (type === "line" || type === "arrow") {
    // Lines and arrows use start/end points instead of width/height
    const defaultLength = 120;
    const position = findBlankArea(shapes, defaultLength, 2); // Minimal height for findBlankArea
    
    s = { 
      id: crypto.randomUUID(), 
      type, 
      x: position.x, 
      y: position.y + 20, // Start point
      w: defaultLength, // Use w to store length for collision detection
      h: 2, // Minimal height for collision detection  
      x2: position.x + defaultLength, // End point
      y2: position.y + 20,
      stroke: colors.text, // Lines use stroke, not fill
      strokeWidth: 3,
      arrowHead: type === "arrow" ? "end" : "none",
      text: "", 
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  } else {
    // Other shapes with theme-aware default colors
    let color = "#3b82f6"; // Default blue
    if (type === "circle") color = "#10b981"; // Green for circles
    if (type === "triangle") color = "#10b981"; // Green
    if (type === "star") color = "#fbbf24"; // Yellow
    if (type === "heart") color = "#ef4444"; // Red
    if (type === "pentagon") color = "#8b5cf6"; // Purple
    if (type === "hexagon") color = "#06b6d4"; // Cyan
    if (type === "octagon") color = "#f59e0b"; // Orange
    if (type === "oval") color = "#84cc16"; // Lime
    if (type === "trapezoid") color = "#ec4899"; // Pink
    if (type === "rhombus") color = "#14b8a6"; // Teal
    if (type === "parallelogram") color = "#f97316"; // Orange
    
    const w = 100;
    const h = 80;
    const position = findBlankArea(shapes, w, h);
    
    s = { 
      id: crypto.randomUUID(), 
      type, 
      x: position.x, 
      y: position.y, 
      w, 
      h, 
      color, 
      stroke: colors.text, // Add visible stroke for dark mode
      strokeWidth: 2,
      text: "", 
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  }
  
  useCanvas.getState().upsert(s); 
  broadcastUpsert(s); 
  persist(s);
  
  // Auto-select the new shape
  useCanvas.getState().select([s.id]);
}

function ClearCanvasButton() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { shapes } = useCanvas();
  const shapeCount = Object.keys(shapes).length;

  const handleClearCanvas = async () => {
    // Save history before clearing so it can be undone
    useCanvas.getState().pushHistory();
    
    // Get all shape IDs before clearing
    const allShapeIds = Object.keys(shapes);
    
    // Clear all shapes locally
    useCanvas.getState().clear();
    
    // Broadcast removal to other users (for multiplayer sync)
    if (allShapeIds.length > 0) {
      await broadcastRemove(allShapeIds);
      
      // Delete from database
      await supabase.from("shapes").delete().eq("room_id", useCanvas.getState().roomId);
    }
    
    // Close confirmation dialog
    setShowConfirmation(false);
  };

  if (shapeCount === 0) {
    return null; // Don't show button if canvas is already empty
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowConfirmation(true)}
        className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
        title="Clear all shapes from canvas"
      >
        🗑️ Clear Canvas
      </button>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Clear Canvas?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to remove all {shapeCount} shape{shapeCount !== 1 ? 's' : ''} from the canvas? 
              This action can be undone with Ctrl+Z.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCanvas}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AIBox() {
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const [working, setWorking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(localStorage.getItem('ai-language') || 'en');

  // Speech recognition language mapping
  const getSpeechLang = (aiLang: string): string => {
    const langMap: Record<string, string> = {
      'en': 'en-US',
      'zh': 'zh-CN', // Mandarin Chinese
      'es': 'es-ES', // Spanish (Spain)
      'fr': 'fr-FR', // French (France)
      'de': 'de-DE', // German (Germany)
      'ja': 'ja-JP', // Japanese
      'ar': 'ar-SA', // Arabic (Saudi Arabia)
    };
    return langMap[aiLang] || 'en-US';
  };

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = getSpeechLang(selectedLanguage);

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQ(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);
    }
  }, [selectedLanguage]); // Re-initialize when language changes

  const startListening = () => {
    if (recognition) {
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
    }
  };
  
  // Save language preference to localStorage
  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    localStorage.setItem('ai-language', lang);
  };
  
  const onRun = async () => { 
    setWorking(true);
    setAiResponse(null);
    
    try {
      const response = await interpretWithResponse(q, selectedLanguage);
      setAiResponse(response);
      
      if (response.type === 'success') {
        setQ(""); // Clear input on success
      }
    } catch (error) {
      setAiResponse({
        type: 'error',
        message: 'An error occurred while processing your request.'
      });
    }
    
    setWorking(false);
  };

  const useSuggestion = (suggestion: string) => {
    setQ(suggestion);
    setAiResponse(null);
  };

  const confirmAction = async () => {
    if (aiResponse?.confirmAction) {
      setWorking(true);
      await aiResponse.confirmAction();
      setAiResponse({
        type: 'success',
        message: '✅ Action completed successfully!'
      });
      setQ("");
      setWorking(false);
    }
  };

  const cancelAction = () => {
    setAiResponse(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !working && q.trim()) {
      onRun();
    }
  };
  
  const groqConfigured = isGroqConfigured();
  const openaiConfigured = isOpenAIConfigured();
  const aiConfigured = groqConfigured || openaiConfigured;
  
  const getAIStatus = () => {
    if (groqConfigured) return { label: 'Groq (Free)', color: 'bg-green-100 text-green-700' };
    if (openaiConfigured) return { label: '🤖 GPT-3.5', color: 'bg-blue-100 text-blue-700' };
    return { label: '📝 Basic', color: 'bg-yellow-100 text-yellow-700' };
  };
  
  const aiStatus = getAIStatus();
  
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">AI Agent</div>
        <div className={`text-xs px-2 py-1 rounded ${aiStatus.color}`}>
          {aiStatus.label}
        </div>
      </div>

      {!aiConfigured && (
        <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-700">
          <strong>💡 Upgrade to Smart AI:</strong><br />
          • <strong>Free:</strong> Add <code>VITE_GROQ_API_KEY</code> (recommended!)<br />
          • <strong>Paid:</strong> Add <code>VITE_OPENAI_API_KEY</code> for GPT-3.5
        </div>
      )}
      
      <div className="flex gap-2">
        <input 
          className="flex-1 border rounded px-2 py-1 min-w-0" 
          placeholder={aiConfigured 
            ? "Try: 'Create a dashboard layout' or 'Make 5 blue circles'" 
            : "e.g., Create a 200x300 rectangle"
          }
          value={q} 
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {recognition && (
          <button
            className={`px-2 py-1 rounded text-white transition-colors flex-shrink-0 ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
            onClick={isListening ? stopListening : startListening}
            disabled={working}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? '🔴' : '🎤'}
          </button>
        )}
      </div>

      {isListening && (
        <p className="text-xs text-blue-600 animate-pulse">
          🎤 Listening in {selectedLanguage === 'zh' ? 'Chinese' : selectedLanguage === 'es' ? 'Spanish' : selectedLanguage === 'fr' ? 'French' : selectedLanguage === 'de' ? 'German' : selectedLanguage === 'ja' ? 'Japanese' : selectedLanguage === 'ar' ? 'Arabic' : 'English'}... speak your command
        </p>
      )}

      <div className="flex gap-2">
        <LanguageDropdown 
          selectedLanguage={selectedLanguage}
          onLanguageChange={handleLanguageChange}
        />
        <button 
          className="px-3 py-2 rounded disabled:opacity-60 flex-1 font-medium"
          style={{
            backgroundColor: colors.primary,
            color: colors.bg, // Use background color as text for contrast
          }}
          disabled={!q||working} 
          onClick={onRun}
        >
        {working?"Thinking…":"Run"}
      </button>
      </div>

      {/* AI Response Section */}
      {aiResponse && (
        <div className={`p-3 rounded-md text-sm ${
          aiResponse.type === 'success' ? 'bg-green-50 border border-green-200' :
          aiResponse.type === 'error' ? 'bg-red-50 border border-red-200' :
          aiResponse.type === 'confirmation_required' ? 'bg-orange-50 border border-orange-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <p className={`font-medium ${
            aiResponse.type === 'success' ? 'text-green-700' :
            aiResponse.type === 'error' ? 'text-red-700' :
            aiResponse.type === 'confirmation_required' ? 'text-orange-700' :
            'text-blue-700'
          }`}>
            {aiResponse.message}
          </p>

          {/* Suggestions */}
          {aiResponse.suggestions && aiResponse.suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-600 mb-1">Try these suggestions:</p>
              <div className="flex flex-wrap gap-1">
                {aiResponse.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                    onClick={() => useSuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirmation Actions */}
          {aiResponse.type === 'confirmation_required' && (
            <div className="mt-2 flex gap-2">
              <button
                className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                onClick={confirmAction}
                disabled={working}
              >
                Yes, proceed
              </button>
              <button
                className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={cancelAction}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

            </div>
  );
}

// ChatGPT-style AI Widget - Bottom Right
function FloatingAIWidget() {
  const { colors, halloweenMode } = useTheme();
  const [isMinimized, setIsMinimized] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 }); // From bottom-right
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(localStorage.getItem('ai-language') || 'en');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCommandType, setSelectedCommandType] = useState('Custom');

  // Command type categories for hints
  const commandTypes = {
    'Custom': {
      icon: '✨',
      placeholder: 'What do you want on your canvas today?',
      examples: ['Create a dashboard layout', 'Build a login form', 'Make a navigation bar']
    },
    'Create': {
      icon: '🎨',
      placeholder: 'create a red circle',
      examples: ['create a red circle', 'add a 200x300 rectangle', 'make text saying "Hello"']
    },
    'Rotate': {
      icon: '🔄',
      placeholder: 'rotate 45 degrees',
      examples: ['rotate 45', 'turn clockwise', 'spin left']
    },
    'Move': {
      icon: '📍',
      placeholder: 'move right 100',
      examples: ['move right 100', 'move down 50', 'move to center', 'move to 200 300']
    },
    'Resize': {
      icon: '📏',
      placeholder: 'make it twice as big',
      examples: ['make it twice as big', 'resize to 200x300', 'make it bigger']
    },
    'Layout': {
      icon: '📐',
      placeholder: 'arrange in a row',
      examples: ['arrange in a row', 'create 3x2 grid', 'layout horizontally']
    },
    'Select': {
      icon: '🎯',
      placeholder: 'select all rectangles',
      examples: ['select the blue circle', 'select all rectangles', 'select all shapes', 'select the largest shape']
    }
  };

  // Handle command type change
  const handleCommandTypeChange = (type: string) => {
    setSelectedCommandType(type);
    if (type !== 'Custom' && commandTypes[type as keyof typeof commandTypes]) {
      setPrompt(commandTypes[type as keyof typeof commandTypes].placeholder);
    }
  };

  // Speech recognition language mapping
  const getSpeechLang = (aiLang: string): string => {
    const langMap: Record<string, string> = {
      'en': 'en-US',
      'zh': 'zh-CN',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'ja': 'ja-JP',
      'ar': 'ar-SA',
    };
    return langMap[aiLang] || 'en-US';
  };

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = getSpeechLang(selectedLanguage);

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPrompt(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);
    }
  }, [selectedLanguage]);

  const startListening = () => {
    if (recognition) {
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
    }
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    localStorage.setItem('ai-language', lang);
  };

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = Math.max(10, Math.min(window.innerWidth - 400, window.innerWidth - e.clientX - dragOffset.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 200, window.innerHeight - e.clientY - dragOffset.y));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isWorking) return;

    setIsWorking(true);
    setErrorMessage(null); // Clear any previous errors
    
    try {
      // Use the existing AIBox logic with language support
      const response = await interpretWithResponse(prompt.trim(), selectedLanguage);
      console.log('AI Response:', response);
      
      // Check if the response indicates an error or lack of understanding
      if (response.type === 'error') {
        setErrorMessage(response.message || "I couldn't understand that command. Try being more specific or check the help menu for examples.");
      } else {
        // Clear the input after successful submission
        setPrompt('');
      }
    } catch (error) {
      console.error('AI Error:', error);
      setErrorMessage("Something went wrong while processing your request. Please try again or use a simpler command.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div 
      className={`fixed z-50 transition-all duration-300 border rounded-xl ${
        isMinimized ? 'w-12 h-12' : 'w-96' 
      }`}
      style={{ 
        bottom: position.y, 
        right: position.x,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
      }}
    >
      {/* Minimized state - just the AI emoji */}
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="w-full h-full flex items-center justify-center text-2xl rounded-xl hover:scale-105 transition-transform"
          title={halloweenMode ? "Open FrAInkenstein" : "Open AI Assistant"}
        >
          {halloweenMode ? '🧟' : '🤖'}
              </button>
      ) : (
        <>
          {/* Header - Draggable */}
          <div 
            className="flex items-center justify-between p-4 border-b cursor-move select-none"
            style={{ 
              borderColor: colors.border,
              color: colors.text,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{halloweenMode ? '🧟' : '🤖'}</span>
              <span className="font-medium">{halloweenMode ? 'FrAInkenstein' : 'AI Assistant'}</span>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded hover:bg-opacity-20 hover:bg-gray-500 flex items-center justify-center text-xs"
              title="Minimize"
            >
              −
            </button>
          </div>

          {/* Chat Input */}
          <div className="p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Command Type Dropdown */}
              <div className="flex gap-2">
                <select
                  value={selectedCommandType}
                  onChange={(e) => handleCommandTypeChange(e.target.value)}
                  className="px-3 py-2 rounded-lg border text-sm font-medium min-w-0 flex-shrink-0"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  disabled={isWorking}
                >
                  {Object.entries(commandTypes).map(([type, info]) => (
                    <option key={type} value={type}>
                      {info.icon} {type}
                    </option>
                  ))}
                </select>
                
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={commandTypes[selectedCommandType as keyof typeof commandTypes]?.placeholder || "What do you want on your canvas today?"}
                  className="flex-1 p-3 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                    minHeight: '60px'
                  }}
                  disabled={isWorking}
                />
              </div>
              
              {/* Command Examples Hint */}
              {selectedCommandType !== 'Custom' && (
                <div className="text-xs space-y-1" style={{ color: colors.textMuted }}>
                  <div className="font-medium">⚡ Fast commands for {selectedCommandType}:</div>
                  <div className="flex flex-wrap gap-1">
                    {commandTypes[selectedCommandType as keyof typeof commandTypes]?.examples.map((example, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPrompt(example)}
                        className="px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: colors.buttonBg,
                          color: colors.textSecondary
                        }}
                      >
                        "{example}"
                      </button>
                    ))}
                  </div>
          </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Language Dropdown */}
                  <LanguageDropdown 
                    selectedLanguage={selectedLanguage}
                    onLanguageChange={handleLanguageChange}
                  />
                  
                  {/* Audio Input Button */}
                  {recognition && (
                    <button
                      type="button"
                      onClick={isListening ? stopListening : startListening}
                      disabled={isWorking}
                      className="p-2 rounded-lg transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: isListening ? colors.primary : colors.buttonBg,
                        color: isListening ? colors.bg : colors.text
                      }}
                      title={isListening ? "Stop listening" : "Start voice input"}
                    >
                      {isListening ? '🔴' : '🎤'}
                    </button>
        )}
      </div>
                
                {/* Send Button - aligned to right */}
                <button
                  type="submit"
                  disabled={!prompt.trim() || isWorking}
                  className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors"
                  style={{
                    backgroundColor: colors.primary,
                    color: colors.bg
                  }}
                >
                  {isWorking ? 'Creating...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
      
      {/* Error Dialog - positioned to the left of the widget */}
      {errorMessage && (
        <div 
          className="fixed z-60 p-4 rounded-lg shadow-lg border max-w-sm"
          style={{ 
            bottom: position.y + 20, 
            right: position.x + (isMinimized ? 80 : 420), // Position to the left of widget
            backgroundColor: colors.bg,
            borderColor: colors.error,
            color: colors.text
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">❌</span>
            <div className="flex-1">
              <div className="font-medium text-sm" style={{ color: colors.error }}>
                {halloweenMode ? 'FrAInkenstein' : 'AI Assistant'} Error
      </div>
              <div className="text-sm mt-1">{errorMessage}</div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-xs mt-2 px-2 py-1 rounded transition-colors"
                style={{
                  backgroundColor: colors.buttonBg,
                  color: colors.textSecondary
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.buttonBg}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Color Picker Component
function ColorPicker({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
    '#FF6348', '#2ED573', '#3742FA', '#F368E0', '#FFA502',
    '#FF3838', '#1DD1A1', '#5352ED', '#FF6B9D', '#FFC048',
    '#C44569', '#F8B500', '#6C5CE7', '#A29BFE', '#FD79A8',
    '#FDCB6E', '#6C5CE7', '#74B9FF', '#00B894', '#E17055',
    '#000000', '#2D3436', '#636E72', '#B2BEC3', '#DDD',
    '#FFFFFF'
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 border">
      <div className="text-sm font-medium mb-3">Choose Color</div>
      <div className="grid grid-cols-6 gap-2">
        {colors.map((c) => (
              <button
            key={c}
            className={`w-8 h-8 rounded-md border-2 hover:scale-110 transition-transform ${
              color === c ? 'border-blue-500 border-4' : 'border-gray-300'
            }`}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
      
      {/* Custom Color Input */}
      <div className="mt-3">
        <label className="text-xs text-gray-600 block mb-1">Custom Color:</label>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-8 rounded border cursor-pointer"
        />
      </div>
    </div>
  );
}

// Context Menu Component
function ContextMenu({ x, y, shapeIds, onClose }: {
  x: number;
  y: number;
  shapeIds: string[];
  onClose: () => void;
}) {
  const [showColorPicker, setShowColorPicker] = useState<'fill' | 'stroke' | null>(null);
  const [position, setPosition] = useState({ x, y });
  const menuRef = useRef<HTMLDivElement>(null);
  const shapes = useCanvas(state => shapeIds.map(id => state.shapes[id]).filter(Boolean));
  const shape = shapes[0]; // For single-shape operations, use the first shape
  const isMultiSelection = shapeIds.length > 1;
  const { colors } = useTheme();
  
  // Smart positioning to keep menu on screen
  useEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let newX = x;
      let newY = y;
      
      // Adjust horizontal position if menu would go off right edge
      if (x + menuRect.width > viewportWidth - 20) {
        newX = Math.max(20, viewportWidth - menuRect.width - 20);
      }
      
      // Adjust vertical position if menu would go off bottom edge  
      if (y + menuRect.height > viewportHeight - 20) {
        newY = Math.max(20, viewportHeight - menuRect.height - 20);
      }
      
      // Ensure menu doesn't go off left/top edges
      newX = Math.max(20, newX);
      newY = Math.max(20, newY);
      
      setPosition({ x: newX, y: newY });
    }
  }, [x, y, showColorPicker]); // Recalculate when color picker opens/closes
  
  // Alignment functions for multiple shapes
  const alignShapes = (alignment: 'left' | 'right' | 'center' | 'top' | 'middle' | 'bottom') => {
    if (shapes.length < 2) return;
    
    // Save history before alignment
    useCanvas.getState().pushHistory();
    
    // Calculate bounds
    const bounds = shapes.map(shape => ({
      id: shape.id,
      left: shape.x,
      right: shape.x + (shape.w || 0),
      top: shape.y,
      bottom: shape.y + (shape.h || 0),
      centerX: shape.x + (shape.w || 0) / 2,
      centerY: shape.y + (shape.h || 0) / 2
    }));
    
    let targetValue: number;
    
    switch (alignment) {
      case 'left':
        targetValue = Math.min(...bounds.map(b => b.left));
        shapes.forEach(shape => {
          const updatedShape = { ...shape, x: targetValue, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
          useCanvas.getState().upsert(updatedShape);
          broadcastUpsert(updatedShape);
          persist(updatedShape);
        });
        break;
        
      case 'right':
        targetValue = Math.max(...bounds.map(b => b.right));
        shapes.forEach(shape => {
          const updatedShape = { ...shape, x: targetValue - (shape.w || 0), updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
          useCanvas.getState().upsert(updatedShape);
          broadcastUpsert(updatedShape);
          persist(updatedShape);
        });
        break;
        
      case 'center':
        const leftmost = Math.min(...bounds.map(b => b.left));
        const rightmost = Math.max(...bounds.map(b => b.right));
        targetValue = (leftmost + rightmost) / 2;
        shapes.forEach(shape => {
          const updatedShape = { ...shape, x: targetValue - (shape.w || 0) / 2, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
          useCanvas.getState().upsert(updatedShape);
          broadcastUpsert(updatedShape);
          persist(updatedShape);
        });
        break;
        
      case 'top':
        targetValue = Math.min(...bounds.map(b => b.top));
        shapes.forEach(shape => {
          const updatedShape = { ...shape, y: targetValue, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
          useCanvas.getState().upsert(updatedShape);
          broadcastUpsert(updatedShape);
          persist(updatedShape);
        });
        break;
        
      case 'middle':
        const topmost = Math.min(...bounds.map(b => b.top));
        const bottommost = Math.max(...bounds.map(b => b.bottom));
        targetValue = (topmost + bottommost) / 2;
        shapes.forEach(shape => {
          const updatedShape = { ...shape, y: targetValue - (shape.h || 0) / 2, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
          useCanvas.getState().upsert(updatedShape);
          broadcastUpsert(updatedShape);
          persist(updatedShape);
        });
        break;
        
      case 'bottom':
        targetValue = Math.max(...bounds.map(b => b.bottom));
        shapes.forEach(shape => {
          const updatedShape = { ...shape, y: targetValue - (shape.h || 0), updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
          useCanvas.getState().upsert(updatedShape);
          broadcastUpsert(updatedShape);
          persist(updatedShape);
        });
        break;
    }
    
    onClose();
  };
  
  const distributeShapes = (direction: 'horizontal' | 'vertical') => {
    if (shapes.length < 3) return; // Need at least 3 shapes to distribute
    
    // Save history before distribution
    useCanvas.getState().pushHistory();
    
    if (direction === 'horizontal') {
      // Sort shapes by x position
      const sortedShapes = [...shapes].sort((a, b) => a.x - b.x);
      const leftmost = sortedShapes[0].x;
      const rightmost = sortedShapes[sortedShapes.length - 1].x + (sortedShapes[sortedShapes.length - 1].w || 0);
      const totalWidth = rightmost - leftmost;
      const shapeWidths = sortedShapes.reduce((sum, shape) => sum + (shape.w || 0), 0);
      const availableSpace = totalWidth - shapeWidths;
      const gap = availableSpace / (sortedShapes.length - 1);
      
      let currentX = leftmost;
      sortedShapes.forEach((shape, index) => {
        if (index === 0 || index === sortedShapes.length - 1) return; // Don't move first and last
        const updatedShape = { ...shape, x: currentX + gap, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
        useCanvas.getState().upsert(updatedShape);
        broadcastUpsert(updatedShape);
        persist(updatedShape);
        currentX += (shape.w || 0) + gap;
      });
    } else {
      // Sort shapes by y position
      const sortedShapes = [...shapes].sort((a, b) => a.y - b.y);
      const topmost = sortedShapes[0].y;
      const bottommost = sortedShapes[sortedShapes.length - 1].y + (sortedShapes[sortedShapes.length - 1].h || 0);
      const totalHeight = bottommost - topmost;
      const shapeHeights = sortedShapes.reduce((sum, shape) => sum + (shape.h || 0), 0);
      const availableSpace = totalHeight - shapeHeights;
      const gap = availableSpace / (sortedShapes.length - 1);
      
      let currentY = topmost;
      sortedShapes.forEach((shape, index) => {
        if (index === 0 || index === sortedShapes.length - 1) return; // Don't move first and last
        const updatedShape = { ...shape, y: currentY + gap, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
        useCanvas.getState().upsert(updatedShape);
        broadcastUpsert(updatedShape);
        persist(updatedShape);
        currentY += (shape.h || 0) + gap;
      });
    }
    
    onClose();
  };
  
  if (!shape) return null;

  const updateShape = (updates: Partial<ShapeBase>) => {
    const updatedShape = { ...shape, ...updates, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
    useCanvas.getState().upsert(updatedShape);
    
    // Broadcast to multiplayer
    broadcastUpsert(updatedShape);
    persist(updatedShape);
  };

  const handleColorChange = (type: 'fill' | 'stroke', newColor: string) => {
    if (type === 'fill') {
      updateShape({ color: newColor });
    } else {
      updateShape({ stroke: newColor });
    }
    setShowColorPicker(null);
  };

  const handleStrokeWidthChange = (width: number) => {
    updateShape({ strokeWidth: width });
  };

  const handleLayerCommand = (command: 'front' | 'back' | 'up' | 'down') => {
    const allCanvasShapes = useCanvas.getState().shapes;
    const allShapesArray = Object.values(allCanvasShapes);
    
    // For multi-selection, operate on the first selected shape for layer commands
    const primaryShapeId = shapeIds[0];
    
    // Assign zIndex if not present (based on current order)
    const shapesWithZIndex = allShapesArray.map((s, index) => ({
      ...s,
      zIndex: s.zIndex ?? index
    }));
    
    // Find current shape
    const currentShape = shapesWithZIndex.find(s => s.id === primaryShapeId);
    if (!currentShape) return;
    
    let newZIndex = currentShape.zIndex;
    const sortedShapes = shapesWithZIndex.sort((a, b) => a.zIndex - b.zIndex);
    const currentIndex = sortedShapes.findIndex(s => s.id === primaryShapeId);
    
    switch (command) {
      case 'front':
        newZIndex = Math.max(...shapesWithZIndex.map(s => s.zIndex)) + 1;
        break;
      case 'back':
        newZIndex = Math.min(...shapesWithZIndex.map(s => s.zIndex)) - 1;
        break;
      case 'up':
        if (currentIndex < sortedShapes.length - 1) {
          const nextShape = sortedShapes[currentIndex + 1];
          newZIndex = nextShape.zIndex + 0.5;
        }
        break;
      case 'down':
        if (currentIndex > 0) {
          const prevShape = sortedShapes[currentIndex - 1];
          newZIndex = prevShape.zIndex - 0.5;
        }
        break;
    }
    
    if (newZIndex !== currentShape.zIndex) {
      updateShape({ zIndex: newZIndex } as any);
    }
    
    onClose();
  };

  const handleDuplicate = () => {
    // Save history before duplicating
    useCanvas.getState().pushHistory();
    
    const duplicatedShapeIds: string[] = [];
    
    // Duplicate all selected shapes
    shapes.forEach((currentShape) => {
      if (!currentShape) return;
      
      // Create duplicate with smart positioning (offset by 20px right and down)
      const duplicateShape = {
        ...currentShape,
        id: Math.random().toString(36).substring(2),
        x: currentShape.x + 20,
        y: currentShape.y + 20,
        // For lines/arrows, also offset the end points
        ...(currentShape.x2 !== undefined && { x2: currentShape.x2 + 20 }),
        ...(currentShape.y2 !== undefined && { y2: currentShape.y2 + 20 }),
        updated_at: Date.now(),
        updated_by: useCanvas.getState().me.id,
      };
      
      duplicatedShapeIds.push(duplicateShape.id);
      
      // Add the duplicated shape
      useCanvas.getState().upsert(duplicateShape);
      
      // Broadcast to multiplayer
      broadcastUpsert(duplicateShape);
      persist(duplicateShape);
    });
    
    // Select the new duplicates
    useCanvas.getState().select(duplicatedShapeIds);
    
    onClose();
  };

  const handleDelete = () => {
    // Save history before deleting so it can be undone with all properties intact
    useCanvas.getState().pushHistory();
    
    useCanvas.getState().remove(shapeIds);
    
    // Broadcast to multiplayer
    broadcastRemove(shapeIds);
    deleteFromDB(shapeIds);
    
    onClose();
  };

  return (
    <div 
      ref={menuRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text
      }} 
      className="rounded-lg shadow-lg border p-3 min-w-[200px]"
    >
      <div className="text-sm font-medium mb-2" style={{ color: colors.text }}>
        {isMultiSelection ? `${shapeIds.length} Objects Selected` : (shape.type === 'text' ? 'Text Options' : 'Shape Options')}
      </div>
      
      <div className="space-y-2">
        {/* Alignment Tools - only show for multiple selections */}
        {isMultiSelection && (
          <>
            <div className="text-xs font-medium mb-1" style={{ color: colors.text }}>Alignment:</div>
            
            {/* Horizontal Alignment */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => alignShapes('left')}
                className="flex-1 px-2 py-1 text-xs rounded border"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                title="Align Left"
              >
                ⬅️
              </button>
              <button
                onClick={() => alignShapes('center')}
                className="flex-1 px-2 py-1 text-xs rounded border"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                title="Align Center"
              >
                ↔️
              </button>
              <button
                onClick={() => alignShapes('right')}
                className="flex-1 px-2 py-1 text-xs rounded border"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                title="Align Right"
              >
                ➡️
              </button>
            </div>
            
            {/* Vertical Alignment */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => alignShapes('top')}
                className="flex-1 px-2 py-1 text-xs rounded border"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                title="Align Top"
              >
                ⬆️
              </button>
              <button
                onClick={() => alignShapes('middle')}
                className="flex-1 px-2 py-1 text-xs rounded border"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                title="Align Middle"
              >
                ↕️
              </button>
              <button
                onClick={() => alignShapes('bottom')}
                className="flex-1 px-2 py-1 text-xs rounded border"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                title="Align Bottom"
              >
                ⬇️
              </button>
            </div>
            
            {/* Distribution - only show for 3+ shapes */}
            {shapes.length >= 3 && (
              <>
                <div className="text-xs font-medium mb-1" style={{ color: colors.text }}>Distribution:</div>
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => distributeShapes('horizontal')}
                    className="flex-1 px-2 py-1 text-xs rounded border"
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      color: colors.text
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                    title="Distribute Horizontally"
                  >
                    ⟷
                  </button>
                  <button
                    onClick={() => distributeShapes('vertical')}
                    className="flex-1 px-2 py-1 text-xs rounded border"
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      color: colors.text
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                    title="Distribute Vertically"
                  >
                    ⥮
                  </button>
                </div>
              </>
            )}
            
            <div className="border-t my-2" style={{ borderColor: colors.border }}></div>
          </>
        )}
        
        {/* Text-specific controls */}
        {shape.type === 'text' && (
          <>
            {/* Text Color */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: colors.text }}>Text Color:</span>
              <button
                className="w-6 h-6 rounded border border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: shape.color || '#111111' }}
                onClick={() => setShowColorPicker(showColorPicker === 'fill' ? null : 'fill')}
              />
            </div>
            
            {/* Font Size */}
            <div className="flex flex-col space-y-1">
              <span className="text-sm" style={{ color: colors.text }}>Font Size:</span>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="256"
                  value={shape.fontSize || 20}
                  onChange={(e) => updateShape({ fontSize: Math.max(1, Math.min(256, parseInt(e.target.value) || 20)) })}
                  className="w-16 text-xs border rounded px-2 py-1"
                  style={{ 
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    color: colors.text 
                  }}
                />
                <input
                  type="range"
                  min="1"
                  max="256"
                  value={shape.fontSize || 20}
                  onChange={(e) => updateShape({ fontSize: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-xs w-8" style={{ color: colors.textMuted }}>px</span>
              </div>
            </div>
            
            {/* Font Family */}
            <div className="flex flex-col">
              <span className="text-sm mb-1" style={{ color: colors.text }}>Font Family:</span>
              <select
                value={shape.fontFamily || "Arial"}
                onChange={(e) => updateShape({ fontFamily: e.target.value })}
                className="text-xs border rounded px-2 py-1"
                style={{ 
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text 
                }}
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
                <option value="Courier New">Courier New</option>
                <option value="Impact">Impact</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
              </select>
            </div>
            
            {/* Text Alignment */}
            <div className="flex flex-col">
              <span className="text-sm mb-1" style={{ color: colors.text }}>Text Alignment:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => updateShape({ textAlign: 'left' })}
                  className="flex-1 px-2 py-1 text-xs rounded border"
                  style={{
                    backgroundColor: (shape.textAlign || 'left') === 'left' ? colors.primary : colors.bg,
                    borderColor: colors.border,
                    color: (shape.textAlign || 'left') === 'left' ? colors.bg : colors.text
                  }}
                >
                  ⬅️ Left
                </button>
                <button
                  onClick={() => updateShape({ textAlign: 'center' })}
                  className="flex-1 px-2 py-1 text-xs rounded border"
                  style={{
                    backgroundColor: shape.textAlign === 'center' ? colors.primary : colors.bg,
                    borderColor: colors.border,
                    color: shape.textAlign === 'center' ? colors.bg : colors.text
                  }}
                >
                  ↔️ Center
                </button>
                <button
                  onClick={() => updateShape({ textAlign: 'right' })}
                  className="flex-1 px-2 py-1 text-xs rounded border"
                  style={{
                    backgroundColor: shape.textAlign === 'right' ? colors.primary : colors.bg,
                    borderColor: colors.border,
                    color: shape.textAlign === 'right' ? colors.bg : colors.text
                  }}
                >
                  ➡️ Right
                </button>
              </div>
            </div>
            
            {/* Text Style */}
            <div className="flex flex-col">
              <span className="text-sm mb-1" style={{ color: colors.text }}>Text Style:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => updateShape({ 
                    fontWeight: shape.fontWeight === 'bold' ? 'normal' : 'bold' 
                  })}
                  className="flex-1 px-2 py-1 text-xs rounded border font-bold"
                  style={{
                    backgroundColor: shape.fontWeight === 'bold' ? colors.primary : colors.bg,
                    borderColor: colors.border,
                    color: shape.fontWeight === 'bold' ? colors.bg : colors.text
                  }}
                >
                  B
                </button>
                <button
                  onClick={() => updateShape({ 
                    fontStyle: shape.fontStyle === 'italic' ? 'normal' : 'italic' 
                  })}
                  className="flex-1 px-2 py-1 text-xs rounded border italic"
                  style={{
                    backgroundColor: shape.fontStyle === 'italic' ? colors.primary : colors.bg,
                    borderColor: colors.border,
                    color: shape.fontStyle === 'italic' ? colors.bg : colors.text
                  }}
                >
                  I
                </button>
                <button
                  onClick={() => updateShape({ 
                    textDecoration: shape.textDecoration === 'underline' ? 'none' : 'underline' 
                  })}
                  className="flex-1 px-2 py-1 text-xs rounded border underline"
                  style={{
                    backgroundColor: shape.textDecoration === 'underline' ? colors.primary : colors.bg,
                    borderColor: colors.border,
                    color: shape.textDecoration === 'underline' ? colors.bg : colors.text
                  }}
                >
                  U
                </button>
              </div>
            </div>
            
            {/* Text Outline Color */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: colors.text }}>Outline Color:</span>
              <button
                className="w-6 h-6 rounded border border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: shape.stroke || '#000000' }}
                onClick={() => setShowColorPicker(showColorPicker === 'stroke' ? null : 'stroke')}
              />
          </div>
            
            {/* Text Outline Width */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: colors.text }}>Outline Width:</span>
              <input
                type="range"
                min="0"
                max="5"
                value={shape.strokeWidth || 0}
                onChange={(e) => updateShape({ strokeWidth: Number(e.target.value) })}
                className="w-16"
              />
              <span className="text-xs w-6 text-center" style={{ color: colors.textMuted }}>{shape.strokeWidth || 0}</span>
          </div>
          </>
        )}
        
        {/* Shape-specific controls */}
        {shape.type !== 'text' && (
          <>
            {/* Fill Color */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: colors.text }}>Fill Color:</span>
              <button
                className="w-6 h-6 rounded border border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: shape.color }}
                onClick={() => setShowColorPicker(showColorPicker === 'fill' ? null : 'fill')}
              />
      </div>
            
            {/* Outline Color */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: colors.text }}>Outline Color:</span>
              <button
                className="w-6 h-6 rounded border border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: shape.stroke || '#000000' }}
                onClick={() => setShowColorPicker(showColorPicker === 'stroke' ? null : 'stroke')}
              />
            </div>
            
            {/* Outline Width */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: colors.text }}>Outline Width:</span>
              <input
                type="range"
                min="0"
                max="10"
                value={shape.strokeWidth || 1}
                onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                className="w-16"
              />
              <span className="text-xs w-6 text-center" style={{ color: colors.textMuted }}>{shape.strokeWidth || 1}</span>
            </div>
            
            {/* Divider */}
            <hr className="my-2" style={{ borderColor: colors.border }} />
            
            {/* Layer Commands */}
            <div className="space-y-1">
              <div className="text-xs font-medium mb-1" style={{ color: colors.textMuted }}>Layer Order</div>
              <button
                onClick={() => { handleLayerCommand('front'); }}
                className="w-full text-left text-sm px-2 py-1 rounded"
                style={{ color: colors.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🔝 Move to Front
              </button>
              <button
                onClick={() => { handleLayerCommand('up'); }}
                className="w-full text-left text-sm px-2 py-1 rounded"
                style={{ color: colors.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                ⬆️ Move Up
              </button>
              <button
                onClick={() => { handleLayerCommand('down'); }}
                className="w-full text-left text-sm px-2 py-1 rounded"
                style={{ color: colors.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                ⬇️ Move Down
              </button>
              <button
                onClick={() => { handleLayerCommand('back'); }}
                className="w-full text-left text-sm px-2 py-1 rounded"
                style={{ color: colors.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🔻 Move to Back
              </button>
            </div>
            
            <hr className="my-2" style={{ borderColor: colors.border }} />
            
            {/* Duplicate */}
            <button
              onClick={handleDuplicate}
              className="w-full text-left text-sm px-2 py-1 rounded"
              style={{ color: colors.text }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              📄 Duplicate
            </button>
            
            {/* Delete */}
            <button
              onClick={handleDelete}
              className="w-full text-left text-sm px-2 py-1 rounded"
              style={{ color: '#dc2626' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              🗑️ Delete Shape
            </button>
          </>
        )}
      </div>
      
      {/* Color Picker Overlay */}
      {showColorPicker && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-25"
          onClick={() => setShowColorPicker(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ColorPicker
              color={showColorPicker === 'fill' ? (shape.color || '#000000') : (shape.stroke || '#000000')}
              onChange={(color) => handleColorChange(showColorPicker!, color)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Shape Components
function ImageShape({ imageUrl, width, height, stroke, strokeWidth }: {
  imageUrl: string; width: number; height: number; stroke?: string; strokeWidth?: number;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous'; // Handle CORS
    img.onload = () => {
      setImage(img);
    };
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const hasStroke = stroke && strokeWidth && strokeWidth > 0;

  if (!image) {
    // Show loading placeholder
  return (
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#f0f0f0"
        stroke="#ddd"
        strokeWidth={2}
        dash={[5, 5]}
      />
    );
  }

  return (
    <>
      {/* Border/Outline if stroke is defined */}
      {hasStroke && (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
      
      {/* The actual image */}
      <KonvaImage
        image={image}
        x={0}
        y={0}
        width={width}
        height={height}
      />
    </>
  );
}

// Line and Arrow Shape Components
function LineShape({ x1, y1, x2, y2, stroke, strokeWidth, dash }: {
  x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number; dash?: number[];
}) {
  return (
    <Line
      points={[x1, y1, x2, y2]}
      stroke={stroke}
      strokeWidth={strokeWidth}
      dash={dash}
      lineCap="round"
      lineJoin="round"
    />
  );
}

function ArrowShape({ x1, y1, x2, y2, stroke, strokeWidth, dash, arrowHead }: {
  x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number; dash?: number[]; arrowHead: string;
}) {
  // Calculate arrow head points
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = Math.max(10, strokeWidth * 3);
  const headAngle = Math.PI / 6; // 30 degrees
  
  // Arrow head points
  const x3 = x2 - headLength * Math.cos(angle - headAngle);
  const y3 = y2 - headLength * Math.sin(angle - headAngle);
  const x4 = x2 - headLength * Math.cos(angle + headAngle);
  const y4 = y2 - headLength * Math.sin(angle + headAngle);
  
  return (
    <>
      {/* Main line */}
      <Line
        points={[x1, y1, x2, y2]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        lineCap="round"
        lineJoin="round"
      />
      {/* Arrow head */}
      {(arrowHead === "end" || arrowHead === "both") && (
        <Line
          points={[x3, y3, x2, y2, x4, y4]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {/* Start arrow head if both */}
      {arrowHead === "both" && (
        <Line
          points={[
            x1 + headLength * Math.cos(angle - headAngle + Math.PI),
            y1 + headLength * Math.sin(angle - headAngle + Math.PI),
            x1,
            y1,
            x1 + headLength * Math.cos(angle + headAngle + Math.PI),
            y1 + headLength * Math.sin(angle + headAngle + Math.PI)
          ]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          lineCap="round"
          lineJoin="round"
        />
      )}
    </>
  );
}

function TriangleShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  const points = [
    width / 2, 0,           // Top point
    0, height,              // Bottom left
    width, height,          // Bottom right
    width / 2, 0            // Close path
  ];
  
  return (
    <Line
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      closed={true}
    />
  );
}

function StarShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  return (
    <RegularPolygon
      x={width / 2}
      y={height / 2}
      sides={5}
      radius={Math.min(width, height) / 2}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      innerRadius={Math.min(width, height) / 4}
    />
  );
}

function HeartShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  // Heart shape using bezier curves
  const w = width;
  const h = height;
  const points = [
    w/2, h*0.3,
    w*0.1, 0,
    0, h*0.3,
    w/2, h,
    w, h*0.3,
    w*0.9, 0,
    w/2, h*0.3
  ];
  
  return (
    <Line
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      closed={true}
      bezier={true}
    />
  );
}

function PentagonShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  return (
    <RegularPolygon
      x={width / 2}
      y={height / 2}
      sides={5}
      radius={Math.min(width, height) / 2}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

function HexagonShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  return (
    <RegularPolygon
      x={width / 2}
      y={height / 2}
      sides={6}
      radius={Math.min(width, height) / 2}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

function OctagonShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  return (
    <RegularPolygon
      x={width / 2}
      y={height / 2}
      sides={8}
      radius={Math.min(width, height) / 2}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

function TrapezoidShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  const points = [
    width * 0.2, 0,        // Top left
    width * 0.8, 0,        // Top right
    width, height,          // Bottom right
    0, height,              // Bottom left
    width * 0.2, 0          // Close path
  ];
  
  return (
    <Line
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      closed={true}
    />
  );
}

function RhombusShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  const points = [
    width / 2, 0,           // Top
    width, height / 2,      // Right
    width / 2, height,      // Bottom
    0, height / 2,          // Left
    width / 2, 0            // Close path
  ];
  
  return (
    <Line
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      closed={true}
    />
  );
}

function ParallelogramShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  const skew = width * 0.2; // 20% skew for parallelogram effect
  const points = [
    skew, 0,                // Top left
    width, 0,               // Top right
    width - skew, height,   // Bottom right
    0, height,              // Bottom left
    skew, 0                 // Close path
  ];
  
  return (
    <Line
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      closed={true}
    />
  );
}

function LanguageDropdown({ selectedLanguage, onLanguageChange }: { 
  selectedLanguage: string; 
  onLanguageChange: (lang: string) => void; 
}) {
  const { colors } = useTheme();
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  ];

  return (
    <div className="relative">
      <select
        value={selectedLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="px-2 py-2 text-xs border rounded transition-colors cursor-pointer appearance-none pr-6"
        style={{
          backgroundColor: colors.buttonBg,
          color: colors.text,
          borderColor: colors.border
        }}
        title="Select AI language"
      >
        {languages.map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <div 
        className="absolute right-1 top-1/2 transform -translate-y-1/2 pointer-events-none text-xs"
        style={{ color: colors.textMuted }}
      >
        ▼
      </div>
    </div>
  );
}


// Broadcasting + persistence helpers with improvements
async function broadcastUpsert(shapes: ShapeBase | ShapeBase[]) {
  if (!roomChannel) return;
  await roomChannel.send({ type: "broadcast", event: "shape:upsert", payload: shapes });
}

async function broadcastRemove(ids: string[]) {
  if (!roomChannel) return;
  await roomChannel.send({ type: "broadcast", event: "shape:remove", payload: ids });
}

// Debounced persistence for 60fps performance
async function persist(shapes: ShapeBase | ShapeBase[]) {
  const list = Array.isArray(shapes) ? shapes : [shapes];
  list.forEach(s => pending.set(s.id, s));
  
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(async () => {
    const rows = Array.from(pending.values()).map((s) => ({ 
      room_id: useCanvas.getState().roomId, 
      ...s 
    }));
    pending.clear();
  await supabase.from("shapes").upsert(rows, { onConflict: "id" });
  }, 150); // 150ms is the sweet spot for batching
}

async function deleteFromDB(ids: string[]) {
  await supabase.from("shapes").delete().in("id", ids);
}
