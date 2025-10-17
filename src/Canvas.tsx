import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Ellipse, Text as KText, Transformer, Group, Line, RegularPolygon, Star, Image as KonvaImage } from "react-konva";
import Konva from 'konva';
import { useCanvas } from "./state/store";
import type { ShapeBase, ShapeType } from "./types";
import { supabase } from "./lib/supabaseClient";
import { interpretWithResponse } from "./ai/agent";
import { isOpenAIConfigured, generateImageWithDALLE } from "./services/openaiService";
import { isGroqConfigured } from "./services/groqService";
import { SaveStatusIndicator } from "./components/SaveStatusIndicator";
import { useTheme } from "./contexts/ThemeContext";
import { CanvasSelector } from "./components/CanvasSelector";
import { AuthStatus } from "./components/AuthStatus";
import * as OfflineQueue from "./services/offlineQueue";

// ================================================================================
// TOAST NOTIFICATION SYSTEM
// ================================================================================
type ToastType = 'info' | 'success' | 'warning' | 'error';
type Toast = {
  id: string;
  message: string;
  type: ToastType;
  timestamp: number;
};

let toastListeners: Array<(toast: Toast) => void> = [];

function showToast(message: string, type: ToastType = 'info') {
  const toast: Toast = {
    id: crypto.randomUUID(),
    message,
    type,
    timestamp: Date.now()
  };
  toastListeners.forEach(listener => listener(toast));
}

function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { colors } = useTheme();

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts(prev => [...prev, toast]);
      
      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 4000);
    };
    
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  const getToastColor = (type: ToastType) => {
    switch (type) {
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return colors.primary;
    }
  };

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return '✓';
      case 'warning': return '⚠️';
      case 'error': return '✕';
      default: return 'ℹ️';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none'
      }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            backgroundColor: colors.bgSecondary,
            border: `2px solid ${getToastColor(toast.type)}`,
            borderRadius: '8px',
            padding: '12px 16px',
            minWidth: '300px',
            maxWidth: '400px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'slideInRight 0.3s ease-out',
            pointerEvents: 'auto'
          }}
        >
          <span style={{ fontSize: '20px', flexShrink: 0 }}>
            {getToastIcon(toast.type)}
          </span>
          <div style={{ flex: 1, color: colors.text, fontSize: '14px' }}>
            {toast.message}
          </div>
        </div>
      ))}
    </div>
  );
}

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
function TopRibbon({ onSignOut, stageRef, setShowHelpPopup, centerOnNewShape, setCenterOnNewShape, offlineQueueState, showPerf, setShowPerf }: { 
  onSignOut: () => void; 
  stageRef: React.RefObject<any>; 
  setShowHelpPopup: (show: boolean) => void;
  centerOnNewShape: boolean;
  setCenterOnNewShape: (value: boolean) => void;
  offlineQueueState: OfflineQueue.OfflineQueueState;
  showPerf: boolean;
  setShowPerf: (value: boolean) => void;
}) {
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [availableCanvases, setAvailableCanvases] = useState<any[]>([]);
  const [isLoadingCanvases, setIsLoadingCanvases] = useState(false);
  const { currentCanvas, shapes } = useCanvas();
  const { theme, colors, setTheme, showFPS, setShowFPS, showGrid, setShowGrid, snapToGrid, setSnapToGrid } = useTheme();
  const fps = useFps();
  
  // Refs for click-outside detection
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  
  // Click-outside detection for dropdown menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Close File menu if clicking outside
      if (showFileMenu && fileMenuRef.current && !fileMenuRef.current.contains(target)) {
        setShowFileMenu(false);
      }
      
      // Close View menu if clicking outside
      if (showViewMenu && viewMenuRef.current && !viewMenuRef.current.contains(target)) {
        setShowViewMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFileMenu, showViewMenu]);

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
    
    const canvasState = useCanvas.getState();
    const hasShapes = Object.keys(canvasState.shapes).length > 0;
    
    let proceed = true;
    if (hasShapes) {
      proceed = confirm('Create a new empty canvas? Your current canvas will be saved automatically.');
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
      // Persistence handled by auto-save system
      
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
        <div className="relative" ref={fileMenuRef}>
          <button
            onClick={() => {
              setShowFileMenu(!showFileMenu);
              setShowViewMenu(false); // Close View menu when opening File
            }}
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
            className="absolute left-0 top-full mt-1 w-48 rounded-md shadow-lg border z-50 animate-slideDown"
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
                
                <button
                  onClick={() => {
                    useCanvas.getState().showCanvasSelectorDialog();
                    setShowFileMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm flex items-center transition-colors"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span className="mr-2">🎨</span>
                  Select Canvas...
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
        <div className="relative" ref={viewMenuRef}>
          <button
            onClick={() => {
              setShowViewMenu(!showViewMenu);
              setShowFileMenu(false); // Close File menu when opening View
            }}
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
              className="absolute left-0 top-full mt-1 w-48 rounded-md shadow-lg border z-50 animate-slideDown"
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
                  <button
                    onClick={() => {
                      setTheme('halloween');
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: theme === 'halloween' ? colors.primary : 'transparent',
                      color: theme === 'halloween' ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (theme !== 'halloween') {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (theme !== 'halloween') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">🎃</span>
                    Halloween Mode
                    {theme === 'halloween' && <span className="ml-auto text-xs">✓</span>}
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
                      const newValue = !centerOnNewShape;
                      setCenterOnNewShape(newValue);
                      localStorage.setItem('centerOnNewShape', newValue.toString());
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: centerOnNewShape ? colors.primary : 'transparent',
                      color: centerOnNewShape ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (!centerOnNewShape) {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!centerOnNewShape) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">🎯</span>
                    Center on New Shape
                    {centerOnNewShape && <span className="ml-auto text-xs">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setSnapToGrid(!snapToGrid);
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: snapToGrid ? colors.primary : 'transparent',
                      color: snapToGrid ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (!snapToGrid) {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!snapToGrid) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">🧲</span>
                    Snap to Grid
                    {snapToGrid && <span className="ml-auto text-xs">✓</span>}
                  </button>
                  
                  {/* #6: Performance Monitor Toggle */}
                  <button
                    onClick={() => {
                      const newValue = !showPerf;
                      setShowPerf(newValue);
                      localStorage.setItem('showPerfMonitor', String(newValue));
                      setShowViewMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm rounded flex items-center transition-colors"
                    style={{
                      backgroundColor: showPerf ? colors.primary : 'transparent',
                      color: showPerf ? colors.bg : colors.text
                    }}
                    onMouseEnter={(e) => {
                      if (!showPerf) {
                        e.currentTarget.style.backgroundColor = colors.buttonHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showPerf) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="mr-2">📊</span>
                    Performance Monitor
                    {showPerf && <span className="ml-auto text-xs">✓</span>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowHelpPopup(true);
              setShowFileMenu(false); // Close File menu when opening Help
              setShowViewMenu(false); // Close View menu when opening Help
            }}
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
            
            {/* Offline Status Indicator */}
            {!offlineQueueState.isOnline && (
              <div 
                className="ml-3 px-3 py-1 text-sm rounded flex items-center gap-2"
                style={{
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #FCD34D'
                }}
                title={`Offline - ${offlineQueueState.queuedOperations.length} operations queued`}
              >
                <span>📴</span>
                <span className="font-medium">Offline</span>
                {offlineQueueState.queuedOperations.length > 0 && (
                  <span className="text-xs bg-amber-600 text-white px-1.5 py-0.5 rounded">
                    {offlineQueueState.queuedOperations.length}
                  </span>
                )}
              </div>
            )}
            
            {/* Syncing Indicator */}
            {offlineQueueState.isSyncing && (
              <div 
                className="ml-3 px-3 py-1 text-sm rounded flex items-center gap-2"
                style={{
                  backgroundColor: '#DBEAFE',
                  color: '#1E40AF',
                  border: '1px solid #93C5FD'
                }}
                title="Syncing queued operations..."
              >
                <span className="animate-spin">🔄</span>
                <span className="font-medium">Syncing...</span>
              </div>
            )}
            
            {/* Sign Out Button */}
            <button
              onClick={onSignOut}
              className="ml-3 px-3 py-1 text-sm rounded transition-colors flex items-center"
              style={{
                backgroundColor: colors.buttonBg,
                color: colors.text,
                border: `1px solid ${colors.border}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.buttonHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.buttonBg;
              }}
              title="Sign out"
            >
              <span className="mr-1">👤</span>
              Sign Out
            </button>
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
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+Shift+D</kbd> Duplicate selected</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+G</kbd> Group selected shapes</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+Shift+G</kbd> Ungroup shapes</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Delete</kbd> Remove selected</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium mb-2" style={{ color: colors.text }}>History:</div>
                      <div className="space-y-1">
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+Z</kbd> Undo last action</div>
                        <div>• <kbd className="px-1 rounded text-xs" style={{ backgroundColor: colors.buttonHover, color: colors.text }}>Ctrl+Y</kbd> Redo last undo</div>
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
  const { openTabs, activeTabId, openCanvasInTab, switchToTab, hasUnsavedTab } = useCanvas();
  const { colors } = useTheme();
  
  // Get current canvas to check if it should be in tabs
  const currentCanvas = useCanvas.getState().currentCanvas;
  
  // Auto-fix: If we have a current canvas but no tabs, add it to tabs
  React.useEffect(() => {
    if (currentCanvas && openTabs.length === 0) {
      // Auto-fixing: Adding current canvas to tabs
      openCanvasInTab(currentCanvas);
    }
  }, [currentCanvas, openTabs.length, openCanvasInTab]);

  const handleNewTab = async () => {
    try {
      const title = prompt('New canvas title:', 'Untitled Canvas') || 'Untitled Canvas';
      console.log('🆕 Creating new tab with title:', title);
      
      const canvasState = useCanvas.getState();
      console.log('📋 Current tabs before creation:', openTabs.map(t => ({ id: t.id, title: t.title })));
      
      const newCanvas = await canvasState.createNewCanvas(title.trim());
      
      // Open the new canvas in a tab
      console.log('📂 Opening new canvas in tab:', { id: newCanvas.id, title: newCanvas.title });
      openCanvasInTab(newCanvas);
      
      console.log('📋 Tabs after creation:', useCanvas.getState().openTabs.map(t => ({ id: t.id, title: t.title })));
      
      // No need to loadCanvas since createNewCanvas already sets up the canvas state
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

    console.log('🔄 Switching to tab:', { canvasId, currentActiveTab: activeTabId });
    
    try {
      const canvasState = useCanvas.getState();
      
      // Save current canvas state before switching
      if (canvasState.currentCanvas && canvasState.hasUnsavedChanges) {
        console.log('💾 Saving current canvas before tab switch');
        await canvasState.triggerManualSave();
      }
      
      // Check if the canvas still exists before switching
      const { canvasService } = await import('./services/canvasService');
      console.log('🔍 Checking if canvas exists:', canvasId);
      const targetCanvas = await canvasService.getCanvas(canvasId);
      console.log('🎯 Canvas lookup result:', { found: !!targetCanvas, canvasId });
      
      if (!targetCanvas) {
        // Canvas not found - ask user what to do instead of auto-removing
        const shouldRemoveTab = confirm(
          `Canvas not found. This might be a temporary connection issue.\n\n` +
          `Would you like to remove this tab? If you choose 'Cancel', we'll keep the tab and you can try again later.`
        );
        
        if (shouldRemoveTab) {
          // User chose to remove the tab
          const updatedTabs = openTabs.filter(tab => tab.id !== canvasId);
          useCanvas.setState({ openTabs: updatedTabs });
          
          if (updatedTabs.length > 0) {
            // Switch to the first remaining tab
            const firstTab = updatedTabs[0];
            switchToTab(firstTab.id);
            await canvasState.loadCanvas(firstTab.id);
          } else {
            // No tabs left, create a new canvas
            const newCanvas = await canvasState.createNewCanvas('New Canvas');
            canvasState.openCanvasInTab(newCanvas);
          }
        }
        // If user chose Cancel, we do nothing and keep the tab
        return;
      }
      
      // Load the canvas shapes first (before switching tab state)
      console.log('📂 Loading canvas shapes before tab switch');
      await canvasState.loadCanvas(canvasId);
      
      // Switch to the tab only after successful load
      console.log('🔄 Updating tab state after successful canvas load');
      switchToTab(canvasId);
    } catch (error) {
      console.error('Tab switch error:', error);
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

// DISABLED: Old debounced persistence system
// const pending = new Map<string, any>();
// let flushTimer: number | null = null;

interface CanvasProps {
  onSignOut: () => void;
}

// Context Menu Types
interface ContextMenuData {
  x: number;
  y: number;
  shapeIds: string[]; // Support multiple shapes for alignment tools
}

// AI Clarification Dialog Component
function AIClarificationDialog() {
  const { colors } = useTheme();
  const { aiConversation, setAIConversation, addAIMessage } = useCanvas();
  const [input, setInput] = useState('');
  
  if (!aiConversation) return null;
  
  const handleResponse = async (response: string) => {
    if (!response.trim()) return;
    
    // Add user's response to history
    addAIMessage('user', response);
    setInput('');
    
    // Import and call the AI agent with the full conversation
    const { interpret } = await import('./ai/agent');
    await interpret(response);
  };
  
  const handleCancel = () => {
    setAIConversation(null);
    showToast('Conversation cancelled', 'info');
  };
  
  return (
    <div
      className="fixed bottom-32 right-4 w-96 bg-opacity-95 backdrop-blur-sm rounded-lg shadow-2xl p-4 z-50 animate-slideIn"
      style={{
        backgroundColor: colors.bg,
        border: `2px solid ${colors.primary}`,
        color: colors.text,
      }}
    >
      {/* Header */}
      <div className="font-bold mb-3 flex items-center justify-between">
        <span className="flex items-center">
          <span className="mr-2">🤔</span>
          AI needs clarification
        </span>
        <button
          onClick={handleCancel}
          className="text-xl leading-none hover:opacity-70 transition-opacity"
          style={{ color: colors.text }}
        >
          ×
        </button>
      </div>
      
      {/* Conversation History */}
      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
        {aiConversation.history.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className="inline-block px-3 py-2 rounded text-sm"
              style={{
                backgroundColor: msg.role === 'user' ? colors.primary : colors.buttonHover,
                color: msg.role === 'user' ? colors.bg : colors.text,
              }}
            >
              {msg.content}
            </span>
          </div>
        ))}
      </div>
      
      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleResponse(input);
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder="Type your response..."
          autoFocus
          className="flex-1 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2"
          style={{
            backgroundColor: colors.buttonHover,
            color: colors.text,
            border: `1px solid ${colors.primary}`,
          }}
        />
        <button
          onClick={() => handleResponse(input)}
          className="px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
          style={{
            backgroundColor: colors.primary,
            color: colors.bg,
          }}
        >
          Send
        </button>
      </div>
      
      <div className="mt-2 text-xs opacity-60">
        Press Enter to send, Escape to cancel
      </div>
    </div>
  );
}

export default function Canvas({ onSignOut }: CanvasProps) {
  const { shapes, selectedIds, me, cursors, showCanvasSelector, hideCanvasSelectorDialog, roomId, setCenterOnShapeCallback, aiConversation } = useCanvas();
  const { colors, showGrid, snapToGrid } = useTheme();
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const [_scale, setScale] = useState(1);
  const [editingText, setEditingText] = useState<{id: string, x: number, y: number, value: string} | null>(null);
  const [centerOnNewShape, setCenterOnNewShape] = useState(() => 
    localStorage.getItem('centerOnNewShape') === 'true'
  );
  
  // Box select tool state
  const [isBoxSelectMode, setIsBoxSelectMode] = useState(false);
  const [boxSelectStart, setBoxSelectStart] = useState<{x: number, y: number} | null>(null);
  const [boxSelectCurrent, setBoxSelectCurrent] = useState<{x: number, y: number} | null>(null);
  const boxSelectRef = useRef<{start: {x: number, y: number} | null, current: {x: number, y: number} | null}>({ start: null, current: null });
  const justCompletedBoxSelect = useRef(false);
  const isPanning = useRef(false);
  const [showHelpPopup, setShowHelpPopup] = useState(false);
  const [status, setStatus] = useState<'connecting'|'online'|'reconnecting'|'offline'>('connecting');
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  // Offline queue state
  const [offlineQueueState, setOfflineQueueState] = useState<OfflineQueue.OfflineQueueState>(
    OfflineQueue.getState()
  );
  
  // Smart Guides state (#5)
  const [smartGuides, setSmartGuides] = useState<{
    vertical: number[];
    horizontal: number[];
  }>({ vertical: [], horizontal: [] });
  
  // Performance monitoring state (#6)
  const [showPerf, setShowPerf] = useState(() => 
    localStorage.getItem('showPerfMonitor') === 'true'
  );
  const [perfMetrics, setPerfMetrics] = useState({
    fps: 60,
    syncLatency: 0,
    shapeCount: 0,
    userCount: 0,
  });
  const fpsFrames = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(performance.now());
  
  const trRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Snap-to-grid utility function
  const snapToGridCoordinate = (value: number, gridSize: number = 25) => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  // Set up auto-center callback for AI agent
  useEffect(() => {
    const shouldCenter = localStorage.getItem('centerOnNewShape') === 'true';
    
    if (shouldCenter && canvasStageRef.current) {
      setCenterOnShapeCallback((shape: ShapeBase) => {
        centerStageOnShape(shape, canvasStageRef);
      });
    } else {
      setCenterOnShapeCallback(null);
    }
    
    // Update when centerOnNewShape changes
    return () => {
      setCenterOnShapeCallback(null);
    };
  }, [centerOnNewShape]);
  
  // #6: Performance monitoring - FPS tracking
  useEffect(() => {
    if (!showPerf) return;
    
    let animationId: number;
    const updateFPS = () => {
      const now = performance.now();
      const delta = now - lastFrameTime.current;
      lastFrameTime.current = now;
      
      fpsFrames.current.push(1000 / delta);
      if (fpsFrames.current.length > 60) fpsFrames.current.shift();
      
      const avgFPS = fpsFrames.current.reduce((a, b) => a + b, 0) / fpsFrames.current.length;
      
      setPerfMetrics(prev => ({
        ...prev,
        fps: Math.round(avgFPS),
        shapeCount: Object.keys(shapes).length,
        userCount: Object.keys(cursors).length + 1, // +1 for current user
      }));
      
      animationId = requestAnimationFrame(updateFPS);
    };
    
    animationId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(animationId);
  }, [showPerf, shapes, cursors]);
  
  // Note: Keyboard shortcuts are now handled by the comprehensive handler below (line ~2392)
  
  // #7: Mobile touch support - Pinch to zoom and two-finger pan
  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage) return;
    
    let lastCenter: { x: number; y: number } | null = null;
    let lastDist = 0;
    
    const getCenter = (p1: Touch, p2: Touch) => ({
      x: (p1.clientX + p2.clientX) / 2,
      y: (p1.clientY + p2.clientY) / 2,
    });
    
    const getDistance = (p1: Touch, p2: Touch) => {
      return Math.sqrt(
        Math.pow(p2.clientX - p1.clientX, 2) + Math.pow(p2.clientY - p1.clientY, 2)
      );
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        const newCenter = getCenter(touch1, touch2);
        const newDist = getDistance(touch1, touch2);
        
        if (lastCenter && lastDist) {
          // Pinch to zoom
          const pointTo = {
            x: newCenter.x - stage.x(),
            y: newCenter.y - stage.y(),
          };
          
          const scale = stage.scaleX() * (newDist / lastDist);
          const newScale = Math.max(0.1, Math.min(5, scale));
          
          stage.scale({ x: newScale, y: newScale });
          
          // Two-finger pan
          const dx = newCenter.x - lastCenter.x;
          const dy = newCenter.y - lastCenter.y;
          
          stage.position({
            x: newCenter.x - pointTo.x * newScale + dx,
            y: newCenter.y - pointTo.y * newScale + dy,
          });
          
          stage.batchDraw();
          setScale(newScale);
        }
        
        lastCenter = newCenter;
        lastDist = newDist;
      }
    };
    
    const handleTouchEnd = () => {
      lastCenter = null;
      lastDist = 0;
    };
    
    const container = stage.container();
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);
  
  // Initialize with last active canvas on app start
  useEffect(() => {
    let isInitializing = false;
    
    const initCanvas = async () => {
      if (isInitializing) {
        console.log('🚫 Canvas initialization already running, skipping duplicate call');
        return;
      }
      
      isInitializing = true;
      console.log('🎬 Starting canvas initialization from useEffect');
      
      try {
        await useCanvas.getState().initializeCanvas();
      } catch (error) {
        console.error('Failed to initialize canvas on startup:', error);
      } finally {
        isInitializing = false;
      }
    };
    
    initCanvas();
  }, []); // Only run once on mount

  // Initialize offline queue system
  useEffect(() => {
    console.log('🔌 Initializing offline queue system...');
    OfflineQueue.initOfflineQueue();
    
    // Subscribe to offline queue state changes
    const unsubscribe = OfflineQueue.onStateChange((newState) => {
      setOfflineQueueState(newState);
      
      // Update connection status based on offline queue state
      if (newState.isOnline && !newState.isSyncing) {
        setStatus('online');
      } else if (!newState.isOnline) {
        setStatus('offline');
      } else if (newState.isSyncing) {
        setStatus('reconnecting');
      }
      
      // Show toast notifications for offline/online transitions
      if (!newState.isOnline && offlineQueueState.isOnline) {
        showToast('📴 You are offline. Changes will be queued and synced when reconnected.', 'warning');
      } else if (newState.isOnline && !offlineQueueState.isOnline) {
        showToast('🟢 Connection restored! Syncing queued changes...', 'success');
        
        // Trigger sync with broadcast functions
        OfflineQueue.syncQueue(async (type, payload) => {
          if (type === 'upsert') {
            await broadcastUpsert(payload as ShapeBase | ShapeBase[]);
          } else if (type === 'remove') {
            await broadcastRemove(payload as string[]);
          }
        });
      }
    });
    
    return () => {
      console.log('🔌 Cleaning up offline queue system...');
      unsubscribe();
      OfflineQueue.cleanupOfflineQueue();
    };
  }, []); // Only run once on mount

  // ================================================================================
  // REALTIME MULTIPLAYER SYNCHRONIZATION WITH CONFLICT RESOLUTION
  // ================================================================================
  // 
  // CONFLICT RESOLUTION STRATEGY: Last-Write-Wins (LWW) with Visual Feedback
  // 
  // Why LWW?
  // --------
  // 1. **Simplicity**: No complex merge logic required for visual design elements
  // 2. **Performance**: Minimal latency - no server-side coordination needed
  // 3. **Predictability**: Users understand "last edit wins" intuitively
  // 4. **Scalability**: Works with unlimited concurrent users without bottlenecks
  // 
  // How It Works:
  // ------------
  // Each shape has `updated_at` (timestamp) and `updated_by` (user ID) metadata.
  // When a shape update arrives via broadcast:
  //   1. Check if local version exists and is being actively edited by current user
  //   2. Compare timestamps: remote.updated_at > local.updated_at
  //   3. If remote is newer AND user was editing locally → Show toast notification
  //   4. Apply the remote update (LWW ensures eventual consistency)
  // 
  // User Feedback:
  // -------------
  // Visual toast notifications inform users when their local changes were 
  // overridden by another user's more recent edit. This transparency builds
  // trust in the collaborative system.
  // 
  // Alternatives Considered:
  // -----------------------
  // - Operational Transform (OT): Too complex for visual design, adds latency
  // - CRDT: Overkill for design tools where "intent" matters more than merge
  // - Locking: Poor UX, creates bottlenecks, requires server coordination
  // - Manual Conflict UI: Interrupts flow, confuses non-technical users
  // 
  // Edge Cases Handled:
  // ------------------
  // - Rapid edits by same user: No conflicts, timestamps ensure order
  // - Network partitions: Auto-reconciles when connection restored (LWW)
  // - Simultaneous edits: Last broadcast wins, loser gets visual feedback
  // - Shape deletion during edit: Remove event takes precedence
  // 
  // Testing Scenarios:
  // -----------------
  // See src/test/multiplayer-conflict.test.ts for:
  // - Simultaneous shape edits by 2+ users
  // - Network reconnection after offline edits
  // - Rapid successive updates to same shape
  // - Delete operations during active editing
  //
  // ================================================================================
  useEffect(() => {
    const roomId = useCanvas.getState().roomId;
    const channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: useCanvas.getState().me.id } } });
    
    // Set global channel reference
    roomChannel = channel;

    channel.on("broadcast", { event: "shape:upsert" }, ({ payload }) => {
      const incomingShapes = Array.isArray(payload) ? payload : [payload];
      const currentState = useCanvas.getState();
      const currentUserId = currentState.me.id;
      const selectedIds = currentState.selectedIds;
      
      // Conflict detection: Check if user was actively editing a shape that changed
      incomingShapes.forEach((incomingShape) => {
        const localShape = currentState.shapes[incomingShape.id];
        
        // Detect conflict: User has this shape selected AND someone else modified it
        if (
          localShape && 
          selectedIds.includes(incomingShape.id) && 
          incomingShape.updated_by !== currentUserId
        ) {
          // Visual feedback: Notify user the selected shape was modified by a collaborator
          showToast(
            `A shape you have selected was modified by a collaborator`,
            'warning'
          );
        }
      });
      
      // Apply LWW: Remote update always wins (eventual consistency)
      currentState.upsert(payload as ShapeBase | ShapeBase[]);
    });
    
    channel.on("broadcast", { event: "shape:remove" }, ({ payload }) => {
      const removedIds = payload as string[];
      const currentState = useCanvas.getState();
      const selectedIds = currentState.selectedIds;
      
      // Check if user had any of the deleted shapes selected
      const hadSelectedShapeDeleted = removedIds.some(id => selectedIds.includes(id));
      if (hadSelectedShapeDeleted) {
        showToast(
          'A shape you were editing was deleted by another user',
          'info'
        );
      }
      
      currentState.remove(removedIds);
    });

    channel.on("presence", { event: "sync" }, () => {
      const presenceState = channel.presenceState();
      const users = Object.keys(presenceState);
      useCanvas.getState().setOnlineUsers(users);
      
      // Update cursors from presence data
      const currentRoomId = useCanvas.getState().roomId;
      const currentUserId = useCanvas.getState().me.id; // Get fresh user ID to avoid stale closure
      Object.entries(presenceState).forEach(([userId, presence]) => {
        if (userId !== currentUserId && presence.length > 0) {
          const presenceData = presence[0] as any;
          if (presenceData.x !== undefined && presenceData.y !== undefined) {
            useCanvas.getState().updateCursor({
              id: userId,
              name: presenceData.name || 'Guest',
              x: presenceData.x,
              y: presenceData.y,
              color: presenceData.color || '#666',
              roomId: presenceData.roomId || currentRoomId, // Use presence roomId or fallback to current
              last: presenceData.last || Date.now()
            });
          }
        }
      });
    });

    channel.on("presence", { event: "join" }, () => {
      // Update online users list when someone joins
      const presenceState = channel.presenceState();
      const users = Object.keys(presenceState);
      useCanvas.getState().setOnlineUsers(users);
    });

    channel.on("presence", { event: "leave" }, ({ key }) => {
      useCanvas.getState().removeCursor(key);
      // Also update online users list to remove the user who left
      const presenceState = channel.presenceState();
      const users = Object.keys(presenceState);
      useCanvas.getState().setOnlineUsers(users);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setStatus('online');
        
        // Wait for channel to fully stabilize before tracking presence
        setTimeout(async () => {
          try {
            const { me, roomId } = useCanvas.getState();
            await channel.track({ 
              id: me.id, 
              name: me.name || "Guest", 
              x: 0, 
              y: 0, 
              color: me.color, 
              roomId: roomId, // Include roomId for isolation
              last: Date.now() 
            });
          } catch (error) {
            console.warn('Presence tracking failed:', error);
          }
        }, 500);
        
      } else if (status === "CHANNEL_ERROR") {
        setStatus('offline');
      } else if (status === "TIMED_OUT") {
        setStatus('reconnecting');
      } else if (status === "CLOSED") {
        setStatus('reconnecting');
      }
    });

    // Connection status monitoring - simplified for deployment
    // TODO: Re-implement when Supabase realtime status API is available
    setStatus('online'); // Assume online for now

    return () => { 
      console.log('🧹 Cleaning up channel and cursors for room:', roomId);
      channel.unsubscribe(); 
      roomChannel = null;
      // Clear cursors when leaving room
      useCanvas.setState({ cursors: {} });
    };
  }, [roomId]); // Re-run when roomId changes to properly clean up old channel

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

  // Cursor broadcast with canvas-relative coordinates (throttled for performance)
  useEffect(() => {
    let raf:number|undefined;
    let lastUpdate = 0;
    const THROTTLE_MS = 33; // ~30 FPS (was 60 FPS with just RAF)
    
    const handler = (e:MouseEvent) => {
      if (raf) cancelAnimationFrame(raf as number);
      raf = requestAnimationFrame(() => {
        const now = Date.now();
        if (now - lastUpdate < THROTTLE_MS) return; // Throttle to 30 FPS
        lastUpdate = now;
        
        const channel = supabase.channel(`room:${useCanvas.getState().roomId}`);
        const { me, roomId } = useCanvas.getState();
        
        // Get canvas-relative coordinates
        const canvasContainer = canvasContainerRef.current;
        if (!canvasContainer) return;
        
        const rect = canvasContainer.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        channel.track({ 
          id: me.id, 
          name: me.name || "Guest", 
          x: canvasX, 
          y: canvasY, 
          color: me.color, 
          roomId: roomId, // Include roomId for isolation
          last: Date.now() 
        });
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
      
      // Redo with Ctrl+Y (changed from Ctrl+R to avoid browser reload conflict)
      if (e.ctrlKey && e.key === 'y') {
        useCanvas.getState().redo();
        e.preventDefault();
        return;
      }
      
      // Duplicate selected shapes with Ctrl+Shift+D (Shift modifier avoids browser bookmark conflict)
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        const selectedIds = useCanvas.getState().selectedIds;
        if (selectedIds.length > 0) {
          // Save history before duplicating
          useCanvas.getState().pushHistory();
          
          // Duplicate shapes (this also selects the new shapes)
          useCanvas.getState().duplicateShapes(selectedIds);
          
          // Get the newly created shapes and apply snapping if enabled
          const newShapes = useCanvas.getState().getSelectedShapes();
          
          // Apply snap-to-grid to duplicated shapes if enabled
          const { snapToGrid } = useTheme();
          if (snapToGrid) {
            const applySnap = (value: number) => {
              const gridSize = 25;
              return Math.round(value / gridSize) * gridSize;
            };
            
            newShapes.forEach(shape => {
              const snappedShape = {
                ...shape,
                x: applySnap(shape.x),
                y: applySnap(shape.y),
                // Also snap end points for lines/arrows
                ...(shape.x2 !== undefined && { x2: applySnap(shape.x2) }),
                ...(shape.y2 !== undefined && { y2: applySnap(shape.y2) }),
                updated_at: Date.now(),
                updated_by: me.id
              };
              useCanvas.getState().upsert(snappedShape);
            });
          }
          
          // Broadcast new shapes to other users
          broadcastUpsert(newShapes);
          
          // Persistence handled by auto-save system
          
          e.preventDefault();
        }
        return;
      }
      
      // Group selected shapes with Ctrl+G
      if (e.ctrlKey && e.key === 'g' && !e.shiftKey) {
        const selectedIds = useCanvas.getState().selectedIds;
        if (selectedIds.length >= 2) {
          // Save history before grouping
          useCanvas.getState().pushHistory();
          
          // Group the shapes
          const groupId = useCanvas.getState().groupShapes(selectedIds);
          
          if (groupId) {
            // Broadcast group changes to multiplayer
            const groupedShapes = useCanvas.getState().getSelectedShapes();
            groupedShapes.forEach(shape => {
              broadcastUpsert(shape);
              // Auto-save handles persistence
            });
            
            console.log(`Grouped ${selectedIds.length} shapes with group ID: ${groupId}`);
          }
          
          e.preventDefault();
        }
        return;
      }
      
      // Ungroup shapes with Ctrl+Shift+G
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        const selectedIds = useCanvas.getState().selectedIds;
        if (selectedIds.length > 0) {
          // Find shapes that are grouped
          const groupIds = new Set(
            selectedIds
              .map(id => useCanvas.getState().shapes[id]?.groupId)
              .filter(Boolean)
          );
          
          if (groupIds.size > 0) {
            // Save history before ungrouping
            useCanvas.getState().pushHistory();
            
            // Ungroup all found groups
            groupIds.forEach(groupId => {
              if (groupId) { // Type guard to ensure groupId is not undefined
                const shapesToUngroup = useCanvas.getState().getGroupShapes(groupId);
                useCanvas.getState().ungroupShapes(groupId);
                
                // Broadcast ungroup changes to multiplayer
                shapesToUngroup.forEach(shape => {
                  const updatedShape = { ...shape, groupId: undefined, updated_at: Date.now(), updated_by: me.id };
                  broadcastUpsert(updatedShape);
                  // Auto-save handles persistence
                });
                
                console.log(`Ungrouped shapes from group ID: ${groupId}`);
              }
            });
          }
          
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
          
          // Get snap settings from theme context
          const { snapToGrid } = useTheme();
          const applySnap = (value: number) => {
            if (!snapToGrid) return value;
            const gridSize = 25;
            return Math.round(value / gridSize) * gridSize;
          };
          
          // Create new shapes with offset positioning
          clipboard.forEach((originalShape: ShapeBase, index: number) => {
            const offsetX = 20 + (index * 5); // Slight cascade effect
            const offsetY = 20 + (index * 5);
            
            const newShape = {
              ...originalShape,
              id: crypto.randomUUID(), // Use proper UUID format
              x: applySnap(originalShape.x + offsetX),
              y: applySnap(originalShape.y + offsetY),
              // Also offset end points for lines/arrows
              ...(originalShape.x2 !== undefined && { x2: applySnap(originalShape.x2 + offsetX) }),
              ...(originalShape.y2 !== undefined && { y2: applySnap(originalShape.y2 + offsetY) }),
              updated_at: Date.now(),
              updated_by: useCanvas.getState().me.id,
            };
            
            useCanvas.getState().upsert(newShape);
            newShapeIds.push(newShape.id);
            
            // Broadcast and persist
            broadcastUpsert(newShape);
            // Auto-save handles persistence
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
              // Auto-save handles persistence
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
        // Auto-save handles persistence
      }
    }
    setEditingText(null);
  };

  // Selection clearing for clicks outside the main canvas area
  const onStageClick = (e:any) => {
    // Don't handle clicks if we just panned
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    
    // Don't handle clicks if we just completed a box select (don't reset flag here, let Rect handler do it)
    if (justCompletedBoxSelect.current) {
      return;
    }
    
    // Don't handle clicks if we're doing box select
    if (isBoxSelectMode && (boxSelectStart || boxSelectCurrent)) {
      return;
    }
    
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

  // Pan functionality + Box Select
  const onStageMouseDown = (e:any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    const clickedOnBackground = e.target.attrs && e.target.attrs.fill === '#fafafa';
    
    if (clickedOnEmpty || clickedOnBackground) {
      const stage = canvasStageRef.current;
      const pointerPos = stage.getPointerPosition();
      
      // If box select mode is active, start selection rectangle
      if (isBoxSelectMode) {
        // Transform screen coordinates to world coordinates
        const scale = stage.scaleX();
        const worldPos = {
          x: (pointerPos.x - stage.x()) / scale,
          y: (pointerPos.y - stage.y()) / scale
        };
        boxSelectRef.current.start = worldPos;
        boxSelectRef.current.current = worldPos;
        setBoxSelectStart(worldPos);
        setBoxSelectCurrent(worldPos);
      } else {
        // Otherwise, setup panning
        stage.startPointerPos = pointerPos;
        stage.startPos = { x: stage.x(), y: stage.y() };
        isPanning.current = false; // Reset panning flag at start
      }
    }
  };

  const onStageMouseMove = (_e:any) => {
    const stage = canvasStageRef.current;
    
    // Handle box select dragging
    if (isBoxSelectMode && boxSelectRef.current.start) {
      const currentPos = stage.getPointerPosition();
      // Transform screen coordinates to world coordinates
      const scale = stage.scaleX();
      const worldPos = {
        x: (currentPos.x - stage.x()) / scale,
        y: (currentPos.y - stage.y()) / scale
      };
      boxSelectRef.current.current = worldPos;
      setBoxSelectCurrent(worldPos);
      return;
    }
    
    // Handle normal panning
    if (!stage.startPointerPos) return;
    
    const currentPos = stage.getPointerPosition();
    const dx = currentPos.x - stage.startPointerPos.x;
    const dy = currentPos.y - stage.startPointerPos.y;
    
    // Mark as panning if we've moved more than a few pixels
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      isPanning.current = true;
    }
    
    stage.position({
      x: stage.startPos.x + dx,
      y: stage.startPos.y + dy,
    });
  };

  const onStageMouseUp = () => {
    const stage = canvasStageRef.current;
    
    // Handle box select completion using refs for immediate values
    if (isBoxSelectMode && boxSelectRef.current.start && boxSelectRef.current.current) {
      const start = boxSelectRef.current.start;
      const current = boxSelectRef.current.current;
      
      // Calculate selection rectangle bounds
      const minX = Math.min(start.x, current.x);
      const maxX = Math.max(start.x, current.x);
      const minY = Math.min(start.y, current.y);
      const maxY = Math.max(start.y, current.y);
      
      // Find all shapes that intersect with the selection rectangle
      const selectedShapeIds: string[] = [];
      Object.values(shapes).forEach(shape => {
        const shapeRight = shape.x + shape.w;
        const shapeBottom = shape.y + shape.h;
        
        // Check if shape intersects with selection rectangle
        const intersects = !(
          shape.x > maxX ||
          shapeRight < minX ||
          shape.y > maxY ||
          shapeBottom < minY
        );
        
        if (intersects) {
          selectedShapeIds.push(shape.id);
        }
      });
      
      // Select the shapes
      if (selectedShapeIds.length > 0) {
        useCanvas.getState().select(selectedShapeIds);
      } else {
        // Clear selection if nothing was selected
        useCanvas.getState().select([]);
      }
      
      // Mark that we just completed a box select to prevent onClick from clearing selection
      justCompletedBoxSelect.current = true;
      
      // Clear box select state
      boxSelectRef.current.start = null;
      boxSelectRef.current.current = null;
      setBoxSelectStart(null);
      setBoxSelectCurrent(null);
      return;
    }
    
    // Clear normal panning
    stage.startPointerPos = null;
    stage.startPos = null;
  };

  // #5: Smart Guides - Calculate alignment guides during drag
  const calculateSmartGuides = (draggedShape: ShapeBase, currentX: number, currentY: number) => {
    const threshold = 5; // Snap threshold in pixels
    const guides: { vertical: number[]; horizontal: number[] } = { vertical: [], horizontal: [] };
    
    const draggedCenterX = currentX + (draggedShape.w || 0) / 2;
    const draggedCenterY = currentY + (draggedShape.h || 0) / 2;
    const draggedRight = currentX + (draggedShape.w || 0);
    const draggedBottom = currentY + (draggedShape.h || 0);
    
    Object.values(shapes).forEach(shape => {
      if (shape.id === draggedShape.id || !shape.w || !shape.h) return;
      
      const shapeCenterX = shape.x + shape.w / 2;
      const shapeCenterY = shape.y + shape.h / 2;
      const shapeRight = shape.x + shape.w;
      const shapeBottom = shape.y + shape.h;
      
      // Check vertical alignments (x-axis)
      if (Math.abs(currentX - shape.x) < threshold) guides.vertical.push(shape.x);
      if (Math.abs(draggedRight - shapeRight) < threshold) guides.vertical.push(shapeRight);
      if (Math.abs(draggedCenterX - shapeCenterX) < threshold) guides.vertical.push(shapeCenterX);
      
      // Check horizontal alignments (y-axis)
      if (Math.abs(currentY - shape.y) < threshold) guides.horizontal.push(shape.y);
      if (Math.abs(draggedBottom - shapeBottom) < threshold) guides.horizontal.push(shapeBottom);
      if (Math.abs(draggedCenterY - shapeCenterY) < threshold) guides.horizontal.push(shapeCenterY);
    });
    
    return guides;
  };
  
  const onDragMove = (id: string, e: any) => {
    const node = e.target;
    const currentShape = shapes[id];
    if (!currentShape) return;
    
    const guides = calculateSmartGuides(currentShape, node.x(), node.y());
    setSmartGuides(guides);
  };
  
  const onDragEnd = (id:string, e:any) => {
    // Clear smart guides
    setSmartGuides({ vertical: [], horizontal: [] });
    
    // Save history before moving
    useCanvas.getState().pushHistory();
    
    const node = e.target;
    const currentShape = useCanvas.getState().shapes[id];
    
    if (!currentShape) return;
    
    // Apply snap-to-grid if enabled
    const snappedX = snapToGridCoordinate(node.x());
    const snappedY = snapToGridCoordinate(node.y());
    
    // Calculate movement offset
    const deltaX = snappedX - currentShape.x;
    const deltaY = snappedY - currentShape.y;
    
    // Update the dragged shape and broadcast final position
    const updatedShape = { ...currentShape, x: snappedX, y: snappedY, updated_at: Date.now(), updated_by: me.id } as ShapeBase;
    useCanvas.getState().upsert(updatedShape);
    broadcastUpsert(updatedShape); // Broadcast final position after drag
    // Auto-save handles persistence
    
    // If shape belongs to a group, move all other shapes in the group
    if (currentShape.groupId) {
      const groupShapes = useCanvas.getState().getGroupShapes(currentShape.groupId);
      
      groupShapes.forEach(groupShape => {
        if (groupShape.id !== id) { // Don't move the shape we already moved
          const newX = snapToGridCoordinate(groupShape.x + deltaX);
          const newY = snapToGridCoordinate(groupShape.y + deltaY);
          
          // Handle lines and arrows - move both start and end points
          let updatedGroupShape: ShapeBase;
          if (groupShape.type === 'line' || groupShape.type === 'arrow') {
            updatedGroupShape = {
              ...groupShape,
              x: newX,
              y: newY,
              x2: groupShape.x2 ? snapToGridCoordinate(groupShape.x2 + deltaX) : undefined,
              y2: groupShape.y2 ? snapToGridCoordinate(groupShape.y2 + deltaY) : undefined,
              updated_at: Date.now(),
              updated_by: me.id
            };
          } else {
            updatedGroupShape = {
              ...groupShape,
              x: newX,
              y: newY,
              updated_at: Date.now(),
              updated_by: me.id
            };
          }
          
          useCanvas.getState().upsert(updatedGroupShape);
          broadcastUpsert(updatedGroupShape);
          // Auto-save handles persistence
        }
      });
    }
  };

  const onTransformEnd = () => {
    const ids = useCanvas.getState().selectedIds;
    if (!ids.length) return;
    
    // Save history before transforming
    useCanvas.getState().pushHistory();
    
    const node = trRef.current.nodes()[0];
    const prev = useCanvas.getState().shapes[ids[0]];
    const scaleX = node.scaleX(); const scaleY = node.scaleY();
    // Apply snap-to-grid for position but not size
    const snappedX = snapToGridCoordinate(node.x());
    const snappedY = snapToGridCoordinate(node.y());
    const next: ShapeBase = {
      ...prev,
      x: snappedX, y: snappedY,
      w: Math.max(10, prev.w * scaleX),
      h: Math.max(10, prev.h * scaleY),
      rotation: node.rotation(),
      updated_at: Date.now(),
      updated_by: me.id
    };
    node.scaleX(1); node.scaleY(1);
    useCanvas.getState().upsert(next); broadcastUpsert(next); // Auto-save handles persistence
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
  // Selected shapes are always rendered on top to ensure they can be dragged
  const shapeEls = useMemo(() => Object.values(shapes)
    .sort((a, b) => {
      const aSelected = selectedIds.includes(a.id);
      const bSelected = selectedIds.includes(b.id);
      
      // Selected shapes always on top
      if (aSelected && !bSelected) return 1;
      if (!aSelected && bSelected) return -1;
      
      // Otherwise sort by zIndex
      return (a.zIndex ?? 0) - (b.zIndex ?? 0);
    })
    .map((s: ShapeBase) => {
    // For text shapes, use explicit dimensions if set, otherwise calculate dynamic dimensions
    let textWidth = s.w;
    let textHeight = s.h;
    let fontSize = s.fontSize || Math.max(16, Math.min(24, s.h * 0.6));
    
    // Only recalculate dimensions for text if width/height seem auto-generated (very small or default)
    // This preserves manually set dimensions (like in card templates)
    if (s.type === 'text' && s.text && (!s.w || s.w < 80 || !s.h || s.h < 20)) {
      const dims = getTextDimensions(s.text, fontSize);
      textWidth = dims.width;
      textHeight = dims.height;
    }
    const onClick = (e: any) => {
      e.cancelBubble = true; // Prevent event from bubbling to stage
      
      // Get all shapes that should be selected (individual shape or entire group)
      const getShapesToSelect = (shapeId: string) => {
        const shape = useCanvas.getState().shapes[shapeId];
        if (shape?.groupId) {
          // If shape is grouped, return all shapes in the group
          return useCanvas.getState().getGroupShapes(shape.groupId).map(s => s.id);
        } else {
          // If shape is not grouped, return just this shape
          return [shapeId];
        }
      };
      
      const shapesToSelect = getShapesToSelect(s.id);
      
      if (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey) {
        const currentSelection = useCanvas.getState().selectedIds;
        
        // Check if any of the shapes to select are already selected
        const alreadySelected = shapesToSelect.some(id => currentSelection.includes(id));
        
        if (alreadySelected) {
          // Remove all shapes in the group from selection
          const newSelection = currentSelection.filter(id => !shapesToSelect.includes(id));
          useCanvas.getState().select(newSelection);
        } else {
          // Add all shapes in the group to selection
          const newSelection = [...currentSelection, ...shapesToSelect];
          useCanvas.getState().select(newSelection);
        }
      } else {
        // Single selection - select the shape or entire group
        const currentSelection = useCanvas.getState().selectedIds;
        
        // Check if we're clicking on already selected group/shape
        const isCurrentlySelected = shapesToSelect.every(id => currentSelection.includes(id)) && 
                                   currentSelection.length === shapesToSelect.length;
        
        if (isCurrentlySelected && shapesToSelect.length === 1) {
          // Deselect if clicking on sole selected shape
          useCanvas.getState().select([]);
        } else {
          // Select the shape or entire group
          useCanvas.getState().select(shapesToSelect);
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
      
      // Smart positioning: offset menu to avoid covering shape
      const menuWidth = 220; // Approximate menu width
      const menuHeight = 400; // Approximate menu height
      const shapePadding = 30; // Extra space around shape
      
      // Get shape bounds to avoid covering it
      const shapeBounds = {
        left: s.x,
        right: s.x + s.w,
        top: s.y,
        bottom: s.y + s.h
      };
      
      // Viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Try positioning to the right of the shape first
      let menuX = shapeBounds.right + shapePadding;
      let menuY = shapeBounds.top;
      
      // If menu goes off right edge, try left side of shape
      if (menuX + menuWidth > viewportWidth) {
        menuX = shapeBounds.left - menuWidth - shapePadding;
      }
      
      // If still off left edge, position based on cursor
      if (menuX < 10) {
        menuX = Math.min(pointer.x + 20, viewportWidth - menuWidth - 10);
      }
      
      // Vertical positioning: try to keep shape visible
      // If menu would extend below viewport, shift up
      if (menuY + menuHeight > viewportHeight) {
        menuY = Math.max(10, viewportHeight - menuHeight - 10);
      }
      
      // Ensure menu is fully visible
      menuX = Math.max(10, Math.min(menuX, viewportWidth - menuWidth - 10));
      menuY = Math.max(10, menuY);
      
      setContextMenu({
        x: menuX,
        y: menuY,
        shapeIds: contextShapeIds
      });
    };
    
    return (
      <Group 
        key={s.id}
        id={s.id}
        x={s.x}
        y={s.y}
        rotation={s.rotation || 0}
        onTap={onClick} 
        onClick={onClick} 
        onContextMenu={onRightClick}
        draggable={true}
        onDragMove={(e) => onDragMove(s.id, e)}
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
              fontFamily={s.fontFamily || "Arial"}
              fontStyle={s.fontStyle || "normal"}
              fontWeight={s.fontWeight || "normal"}
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
            {s.textDecoration === 'underline' && (() => {
              // Calculate actual text width more accurately
              const text = s.text || "Text";
              const lines = text.split('\n');
              const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
              // Better approximation: 0.55 * fontSize per character (closer to actual rendering)
              const actualTextWidth = Math.min(textWidth, longestLine.length * fontSize * 0.55);
              
              return (
                <Line 
                  points={[0, textHeight - 2, actualTextWidth, textHeight - 2]}
                  stroke={s.color || "#111"}
                  strokeWidth={Math.max(1, fontSize * 0.05)}
                />
              );
            })()}
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
          <Ellipse
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
            {/* Validate line coordinates to prevent NaN warnings */}
            {(() => {
              const x2 = typeof s.x2 === 'number' && !isNaN(s.x2) ? s.x2 : s.x + 100;
              const y2 = typeof s.y2 === 'number' && !isNaN(s.y2) ? s.y2 : s.y;
              const dx = x2 - s.x;
              const dy = y2 - s.y;
              
              return (
                <>
                  {/* Invisible hit area for easier selection */}
                  <Line
                    points={[0, 0, dx, dy]}
                    stroke="transparent"
                    strokeWidth={Math.max(10, (s.strokeWidth || 1) + 8)} // At least 10px hit area
                    lineCap="round"
                    lineJoin="round"
                  />
                  {/* Actual visible line */}
                  <LineShape
                    x1={0}
                    y1={0}
                    x2={dx}
                    y2={dy}
                    stroke={s.stroke || "#000"}
                    strokeWidth={s.strokeWidth || 1}
                    dash={s.dashPattern}
                  />
                </>
              );
            })()}
          </>
        )}
        {s.type === "arrow" && (
          <>
            {/* Validate arrow coordinates to prevent NaN warnings */}
            {(() => {
              const x2 = typeof s.x2 === 'number' && !isNaN(s.x2) ? s.x2 : s.x + 100;
              const y2 = typeof s.y2 === 'number' && !isNaN(s.y2) ? s.y2 : s.y;
              const dx = x2 - s.x;
              const dy = y2 - s.y;
              
              return (
                <>
                  {/* Invisible hit area for easier selection */}
                  <Line
                    points={[0, 0, dx, dy]}
                    stroke="transparent"
                    strokeWidth={Math.max(10, (s.strokeWidth || 1) + 8)} // At least 10px hit area
                    lineCap="round"
                    lineJoin="round"
                  />
                  {/* Actual visible arrow */}
                  <ArrowShape
                    x1={0}
                    y1={0}
                    x2={dx}
                    y2={dy}
                    stroke={s.stroke || "#000"}
                    strokeWidth={s.strokeWidth || 1}
                    dash={s.dashPattern}
                    arrowHead={s.arrowHead || "end"}
                  />
                </>
              );
            })()}
          </>
        )}
        {s.type === "frame" && (
          <>
            {/* Background for the frame */}
            <Rect 
              x={0}
              y={0}
              width={s.w}
              height={s.h}
              fill={s.generatedImageUrl ? "transparent" : (s.color || "#f8f9fa")}
              stroke={s.stroke || "#6c757d"}
              strokeWidth={s.strokeWidth || 2}
              dash={s.generatedImageUrl ? undefined : [8, 4]} // Dashed border when empty
              cornerRadius={4}
            />
            {/* Show generated image if available */}
            {s.generatedImageUrl && (
              <ImageShape
                imageUrl={s.generatedImageUrl}
                width={s.w}
                height={s.h}
                stroke={s.stroke}
                strokeWidth={s.strokeWidth}
              />
            )}
            {/* Loading indicator when generating */}
            {s.isGenerating && (
              <>
                <Rect 
                  x={0}
                  y={0}
                  width={s.w}
                  height={s.h}
                  fill="rgba(0,0,0,0.1)"
                  cornerRadius={4}
                />
                <KText
                  x={0}
                  y={0}
                  text="Generating AI Image..."
                  fontSize={16}
                  fill="#666"
                  align="center"
                  verticalAlign="middle"
                  width={s.w}
                  height={s.h}
                />
              </>
            )}
            {/* Placeholder text when empty */}
            {!s.generatedImageUrl && !s.isGenerating && (
              <KText
                x={0}
                y={0}
                text="Right-click to generate AI image"
                fontSize={14}
                fill="#6c757d"
                align="center"
                verticalAlign="middle"
                width={s.w}
                height={s.h}
              />
            )}
          </>
        )}
        {s.type === "cylinder" && (
          <CylinderShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
        {s.type === "document" && (
          <DocumentShape
            width={s.w}
            height={s.h}
            fill={s.color || "#000"}
            stroke={s.stroke || "#000"}
            strokeWidth={s.strokeWidth || 1}
          />
        )}
      </Group>
    );
  }), [shapes, selectedIds]);

  const canvasStageRef = useRef<any>(null);

  // Canvas selector handlers
  const handleCanvasSelect = async (canvas: any) => {
    try {
      console.log('🎯 User selected canvas:', canvas.title);
      hideCanvasSelectorDialog();
      
      const canvasState = useCanvas.getState();
      await canvasState.loadCanvas(canvas.id);
      canvasState.openCanvasInTab(canvas);
    } catch (error) {
      console.error('Failed to load selected canvas:', error);
      alert('Failed to load canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCreateNewCanvas = async (title: string) => {
    try {
      console.log('🆕 User creating new canvas:', title);
      hideCanvasSelectorDialog();
      
      const canvasState = useCanvas.getState();
      const newCanvas = await canvasState.createNewCanvas(title);
      canvasState.openCanvasInTab(newCanvas);
    } catch (error) {
      console.error('Failed to create new canvas:', error);
      alert('Failed to create canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSkipCanvasSelection = async () => {
    try {
      console.log('⏭️ User skipped canvas selection, creating default canvas');
      hideCanvasSelectorDialog();
      
      const canvasState = useCanvas.getState();
      // Use current date to make it more meaningful than generic "My First Canvas"
      const today = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const newCanvas = await canvasState.createNewCanvas(`Workspace ${today}`);
      canvasState.openCanvasInTab(newCanvas);
    } catch (error) {
      console.error('Failed to create default canvas:', error);
      alert('Failed to create canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div 
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: colors.bgSecondary }}
    >
      {/* Canvas Selector Modal */}
      {showCanvasSelector && (
        <CanvasSelector
          onCanvasSelect={handleCanvasSelect}
          onCreateNew={handleCreateNewCanvas}
          onSkip={handleSkipCanvasSelection}
        />
      )}
      
      {/* Authentication Status Notification */}
      <AuthStatus />
      
      {/* Layout fix v2: Force cache refresh for production deployment */}
      <TopRibbon 
        onSignOut={onSignOut} 
        stageRef={canvasStageRef} 
        setShowHelpPopup={setShowHelpPopup}
        centerOnNewShape={centerOnNewShape}
        setCenterOnNewShape={setCenterOnNewShape}
        offlineQueueState={offlineQueueState}
        showPerf={showPerf}
        setShowPerf={setShowPerf}
      />
      <TabBar />
      <div className="flex-1 flex min-h-0">
        <Toolbar 
          status={status} 
          centerOnNewShape={centerOnNewShape} 
          stageRef={canvasStageRef} 
          isBoxSelectMode={isBoxSelectMode}
          setIsBoxSelectMode={setIsBoxSelectMode}
        />
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
              onClick={() => {
                // Don't clear selection if we just panned
                if (isPanning.current) {
                  isPanning.current = false;
                  return;
                }
                // Don't clear selection if we just completed a box select
                if (justCompletedBoxSelect.current) {
                  justCompletedBoxSelect.current = false;
                  return;
                }
                useCanvas.getState().select([]);
              }}
              onTap={() => {
                // Don't clear selection if we just panned
                if (isPanning.current) {
                  isPanning.current = false;
                  return;
                }
                // Don't clear selection if we just completed a box select
                if (justCompletedBoxSelect.current) {
                  justCompletedBoxSelect.current = false;
                  return;
                }
                useCanvas.getState().select([]);
              }}
            />
            
            {/* Grid Overlay */}
            {showGrid && <GridOverlay canvasSize={canvasSize} />}
            {shapeEls}
            {/* #5: Smart Guides - Alignment guides during drag */}
            {smartGuides.vertical.map((x, i) => (
              <Line
                key={`v-guide-${i}`}
                points={[x, 0, x, canvasSize.height]}
                stroke="#ff00ff"
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
              />
            ))}
            {smartGuides.horizontal.map((y, i) => (
              <Line
                key={`h-guide-${i}`}
                points={[0, y, canvasSize.width, y]}
                stroke="#ff00ff"
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
              />
            ))}
            
            {/* Box Select Rectangle */}
            {isBoxSelectMode && boxSelectStart && boxSelectCurrent && (
              <Rect
                x={Math.min(boxSelectStart.x, boxSelectCurrent.x)}
                y={Math.min(boxSelectStart.y, boxSelectCurrent.y)}
                width={Math.abs(boxSelectCurrent.x - boxSelectStart.x)}
                height={Math.abs(boxSelectCurrent.y - boxSelectStart.y)}
                fill="rgba(0, 123, 255, 0.1)"
                stroke="#007bff"
                strokeWidth={2}
                dash={[5, 5]}
                listening={false}
              />
            )}
            
            <Transformer 
              ref={trRef} 
              rotateEnabled={
                selectedIds.length > 0 && 
                !selectedIds.some(id => {
                  const shape = shapes[id];
                  return shape && (shape.type === 'line' || shape.type === 'arrow');
                })
              } 
              onTransformEnd={onTransformEnd} 
            />
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
        
        {/* Multiplayer cursors - filtered by current room, transformed to screen coordinates */}
        {Object.values(cursors)
          .filter(cursor => cursor.id !== me.id && cursor.roomId === roomId)
          .map((cursor) => {
            // Transform canvas coordinates to screen coordinates
            const stage = canvasStageRef.current;
            const stagePos = stage ? stage.position() : { x: 0, y: 0 };
            const stageScale = stage ? stage.scaleX() : 1;
            
            const screenX = cursor.x * stageScale + stagePos.x;
            const screenY = cursor.y * stageScale + stagePos.y;
            
            // Get user initials for avatar bubble
            const getInitials = (name: string) => {
              const parts = name.trim().split(' ');
              if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
              }
              return name.slice(0, 2).toUpperCase();
            };
            
            return (
              <div
                key={cursor.id}
                className="absolute pointer-events-none z-40 transition-all duration-75"
                style={{
                  left: screenX,
                  top: screenY,
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
                
                {/* Avatar bubble and name label container */}
                <div className="absolute top-6 left-2 flex items-center gap-1.5">
                  {/* Avatar bubble */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md border-2 border-white"
                    style={{ backgroundColor: cursor.color }}
                    title={cursor.name}
                  >
                    {getInitials(cursor.name)}
                  </div>
                  
                  {/* User name label */}
                  <div
                    className="px-2 py-1 rounded text-xs font-medium text-white shadow-lg whitespace-nowrap"
                    style={{ backgroundColor: cursor.color }}
                  >
                    {cursor.name}
                  </div>
                </div>
              </div>
            );
          })}
        
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
      
      {/* AI Clarification Dialog */}
      {aiConversation?.isActive && <AIClarificationDialog />}
      
      {/* Help Popup */}
      <HelpPopup isOpen={showHelpPopup} onClose={() => setShowHelpPopup(false)} />
      
      {/* #6: Performance Monitor Dashboard */}
      {showPerf && (
        <div
          className="fixed top-16 right-4 bg-opacity-90 backdrop-blur-sm rounded-lg shadow-2xl p-4 z-50 text-sm"
          style={{
            backgroundColor: colors.bg,
            border: `2px solid ${colors.primary}`,
            color: colors.text,
            minWidth: '200px',
          }}
        >
          <div className="font-bold mb-3 flex items-center justify-between">
            <span className="flex items-center">
              📊 Performance
            </span>
            <button
              onClick={() => {
                setShowPerf(false);
                localStorage.setItem('showPerfMonitor', 'false');
              }}
              className="text-xl leading-none hover:opacity-70"
              style={{ color: colors.text }}
            >
              ×
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="opacity-75">FPS:</span>
              <span className="font-mono font-bold" style={{ 
                color: perfMetrics.fps >= 50 ? '#10b981' : perfMetrics.fps >= 30 ? '#f59e0b' : '#ef4444'
              }}>
                {perfMetrics.fps}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="opacity-75">Shapes:</span>
              <span className="font-mono">{perfMetrics.shapeCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="opacity-75">Users:</span>
              <span className="font-mono">{perfMetrics.userCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="opacity-75">Status:</span>
              <span className="font-mono capitalize" style={{
                color: status === 'online' ? '#10b981' : status === 'reconnecting' ? '#f59e0b' : '#ef4444'
              }}>
                {status}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notification System */}
      <ToastContainer />
    </div>
  );
}

interface ToolbarProps {
  onSignOut: () => void;
  status: 'connecting'|'online'|'reconnecting'|'offline';
}

function CategorizedToolbar({ centerOnNewShape, stageRef, isBoxSelectMode, setIsBoxSelectMode }: { 
  centerOnNewShape: boolean; 
  stageRef: React.RefObject<Konva.Stage>;
  isBoxSelectMode: boolean;
  setIsBoxSelectMode: (value: boolean) => void;
}) {
  const { colors, snapToGrid } = useTheme();
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

  const addRect = () => addShape("rect", colors, snapToGrid, centerOnNewShape, stageRef);
  const addCircle = () => addShape("circle", colors, snapToGrid, centerOnNewShape, stageRef);
  const addText = () => addShape("text", colors, snapToGrid, centerOnNewShape, stageRef);
  const addFrame = () => addShape("frame", colors, snapToGrid, centerOnNewShape, stageRef);
  const addTriangle = () => addShape("triangle", colors, snapToGrid, centerOnNewShape, stageRef);
  const addStar = () => addShape("star", colors, snapToGrid, centerOnNewShape, stageRef);
  const addHeart = () => addShape("heart", colors, snapToGrid, centerOnNewShape, stageRef);
  const addPentagon = () => addShape("pentagon", colors, snapToGrid, centerOnNewShape, stageRef);
  const addHexagon = () => addShape("hexagon", colors, snapToGrid, centerOnNewShape, stageRef);
  const addOctagon = () => addShape("octagon", colors, snapToGrid, centerOnNewShape, stageRef);
  const addOval = () => addShape("oval", colors, snapToGrid, centerOnNewShape, stageRef);
  const addTrapezoid = () => addShape("trapezoid", colors, snapToGrid, centerOnNewShape, stageRef);
  const addRhombus = () => addShape("rhombus", colors, snapToGrid, centerOnNewShape, stageRef);
  const addParallelogram = () => addShape("parallelogram", colors, snapToGrid, centerOnNewShape, stageRef);
  const addCylinder = () => addShape("cylinder", colors, snapToGrid, centerOnNewShape, stageRef);
  const addDocument = () => addShape("document", colors, snapToGrid, centerOnNewShape, stageRef);
  
  // Line and arrow creation functions
  const addLine = () => addShape("line", colors, snapToGrid, centerOnNewShape, stageRef);
  const addArrow = () => addShape("arrow", colors, snapToGrid, centerOnNewShape, stageRef);
  
  // AI Template Command Handler - triggers AI to create complex layouts
  const handleAITemplateCommand = async (command: string) => {
    // Use the existing AI command system to process the template request
    const { interpret } = await import('./ai/agent');
    try {
      const result = await interpret(command);
      if (result && typeof result === 'object' && 'error' in result) {
        showToast(`AI: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('AI template command error:', error);
      showToast('Failed to create template', 'error');
    }
  };

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
    
    // Helper function to apply snapping if enabled
    const applySnap = (value: number) => {
      if (!snapToGrid) return value;
      const gridSize = 25;
      return Math.round(value / gridSize) * gridSize;
    };

    const emojiShape: ShapeBase = { 
      id: crypto.randomUUID(), 
      type: "image", 
      x: applySnap(position.x), 
      y: applySnap(position.y), 
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
    // Auto-save handles persistence
    
    // Auto-select the new emoji
    useCanvas.getState().select([emojiShape.id]);

    // Center on new shape if enabled
    if (centerOnNewShape && stageRef.current) {
      centerStageOnShape(emojiShape, stageRef);
    }
  };

  // Load saved components from localStorage
  const [savedComponents, setSavedComponents] = useState<any[]>([]);
  const [componentRefreshKey, setComponentRefreshKey] = useState(0);
  
  const refreshComponents = () => {
    try {
      const components = JSON.parse(localStorage.getItem('collabcanvas_components') || '[]');
      setSavedComponents(components);
    } catch (error) {
      console.error('Failed to load components:', error);
    }
  };
  
  useEffect(() => {
    refreshComponents();
  }, [componentRefreshKey]);
  
  // Listen for component saves via custom event
  useEffect(() => {
    const handleComponentSaved = () => {
      setComponentRefreshKey(prev => prev + 1);
    };
    window.addEventListener('componentsUpdated', handleComponentSaved);
    return () => window.removeEventListener('componentsUpdated', handleComponentSaved);
  }, []);
  
  // Handler to insert a component onto the canvas
  const handleInsertComponent = (component: any) => {
    useCanvas.getState().pushHistory();
    
    const { me } = useCanvas.getState();
    const newShapeIds: string[] = [];
    
    // Insert all shapes from the component
    component.shapes.forEach((templateShape: any) => {
      const newId = crypto.randomUUID();
      const newShape: ShapeBase = {
        ...templateShape,
        id: newId,
        // Offset from origin to avoid overlap with existing shapes
        x: 300 + templateShape.x,
        y: 200 + templateShape.y,
        updated_at: Date.now(),
        updated_by: me.id,
      };
      useCanvas.getState().upsert(newShape);
      broadcastUpsert(newShape);
      newShapeIds.push(newId);
    });
    
    // Select the newly inserted shapes
    useCanvas.getState().select(newShapeIds);
    
    // Center on the first shape if enabled
    if (centerOnNewShape && stageRef.current && newShapeIds.length > 0) {
      const firstShape = useCanvas.getState().shapes[newShapeIds[0]];
      if (firstShape) {
        centerStageOnShape(firstShape, stageRef);
      }
    }
    
    showToast(`Component "${component.name}" inserted!`, 'success');
  };
  
  const toolCategories = [
    {
      id: 'tools',
      name: 'Tools',
      emoji: '🛠️',
      tools: [
        { name: '🔲', action: () => setIsBoxSelectMode(!isBoxSelectMode), available: true, tooltip: 'Box Select Tool', active: isBoxSelectMode },
        { name: '✏️', action: () => showToast('Pen Tool - Coming Soon!', 'info'), available: false, tooltip: 'Pen Tool (Coming Soon)' },
      ]
    },
    {
      id: 'components',
      name: 'Components',
      emoji: '🧩',
      tools: savedComponents.map(component => ({
        name: component.name.length > 10 ? component.name.slice(0, 9) + '…' : component.name, // Show up to 10 chars with ellipsis
        action: () => handleInsertComponent(component),
        available: true,
        tooltip: component.name, // Full name in tooltip
      }))
    },
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
        { name: '👍', action: () => addEmoji('👍'), available: true, tooltip: 'Thumbs Up' },
        { name: '🔥', action: () => addEmoji('🔥'), available: true, tooltip: 'Fire' },
        { name: '💡', action: () => addEmoji('💡'), available: true, tooltip: 'Light Bulb' },
        { name: '🚀', action: () => addEmoji('🚀'), available: true, tooltip: 'Rocket' },
        { name: '🎉', action: () => addEmoji('🎉'), available: true, tooltip: 'Party' },
        { name: '💻', action: () => addEmoji('💻'), available: true, tooltip: 'Computer' },
        { name: '🎵', action: () => addEmoji('🎵'), available: true, tooltip: 'Music Note' },
        { name: '🌟', action: () => addEmoji('🌟'), available: true, tooltip: 'Glowing Star' },
        { name: '🎨', action: () => addEmoji('🎨'), available: true, tooltip: 'Artist Palette' },
        { name: '📚', action: () => addEmoji('📚'), available: true, tooltip: 'Books' },
        { name: '🏆', action: () => addEmoji('🏆'), available: true, tooltip: 'Trophy' },
      ]
    },
    {
      id: 'flowchart',
      name: 'Flowchart',
      emoji: '📊',
      tools: [
        { name: '▭', action: addRect, available: true, tooltip: 'Process (Rectangle)' },
        { name: '◆', action: addRhombus, available: true, tooltip: 'Decision (Diamond)' },
        { name: '⬯', action: addOval, available: true, tooltip: 'Start/End (Oval)' },
        { name: '🗎', action: addDocument, available: true, tooltip: 'Document' },
        { name: '⌭', action: addCylinder, available: true, tooltip: 'Database (Cylinder)' },
        { name: '▱', action: addParallelogram, available: true, tooltip: 'Input/Output' },
      ]
    },
    {
      id: 'assets',
      name: 'Assets & Templates',
      emoji: '📦',
      tools: [
        { name: '📝', action: addText, available: true, tooltip: 'Text Box' },
        { name: '🖼️', action: addFrame, available: true, tooltip: 'AI Image Frame' },
        { name: '🔐', action: () => handleAITemplateCommand('create a login form with username and password fields'), available: true, tooltip: 'Login Form' },
        { name: '☰', action: () => handleAITemplateCommand('create a navigation bar'), available: true, tooltip: 'Nav Bar' },
        { name: '🗃️', action: () => handleAITemplateCommand('create a card layout'), available: true, tooltip: 'Card Layout' },
        { name: '📱', action: () => handleAITemplateCommand('create a mobile header'), available: true, tooltip: 'Mobile Header' },
        { name: '🏠', action: () => handleAITemplateCommand('create a hero section'), available: true, tooltip: 'Hero Section' },
        { name: '📧', action: () => handleAITemplateCommand('create a contact form'), available: true, tooltip: 'Contact Form' },
        { name: '👤', action: () => handleAITemplateCommand('create a user profile'), available: true, tooltip: 'User Profile' },
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
                          backgroundColor: (tool as any).active ? colors.primary : (tool.available ? colors.buttonBg : colors.bgTertiary),
                          color: (tool as any).active ? '#fff' : (tool.available ? colors.text : colors.textMuted),
                          borderColor: (tool as any).active ? colors.primary : colors.border,
                          borderWidth: (tool as any).active ? '2px' : '1px'
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
            // Helper function to apply snapping if enabled
            const applySnap = (value: number) => {
              if (!snapToGrid) return value;
              const gridSize = 25;
              return Math.round(value / gridSize) * gridSize;
            };
            
            const batch: ShapeBase[] = [];
            for (let i = 0; i < 500; i++) {
              const baseX = 50 + (i % 25) * 90;
              const baseY = 80 + Math.floor(i / 25) * 60;
              batch.push({ 
                id: crypto.randomUUID(), 
                type: "rect", 
                x: applySnap(baseX), 
                y: applySnap(baseY), 
                w: 80, 
                h: 40, 
                color: "#e5e7eb", 
                updated_at: Date.now(), 
                updated_by: me.id 
              });
            }
            useCanvas.getState().upsert(batch); 
            broadcastUpsert(batch); 
            // Auto-save handles persistence
          }}
          title="Create 500 shapes for stress testing"
        >
          🧪 +500 Stress Test
        </button>
      </div>
    </div>
  );
}

function Toolbar({ status, centerOnNewShape, stageRef, isBoxSelectMode, setIsBoxSelectMode }: Omit<ToolbarProps, 'onSignOut'> & { 
  centerOnNewShape: boolean; 
  stageRef: React.RefObject<Konva.Stage>;
  isBoxSelectMode: boolean;
  setIsBoxSelectMode: (value: boolean) => void;
}) {
  const { me, onlineUsers, cursors } = useCanvas();
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
      
      <CategorizedToolbar 
        centerOnNewShape={centerOnNewShape} 
        stageRef={stageRef}
        isBoxSelectMode={isBoxSelectMode}
        setIsBoxSelectMode={setIsBoxSelectMode}
      />
      
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
            <span className="font-mono font-medium">{useCanvas.getState().roomId}</span>
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

// Helper function to center the stage on a shape
function centerStageOnShape(shape: ShapeBase, stageRef: React.RefObject<Konva.Stage>) {
  const stage = stageRef.current;
  if (!stage) return;

  const stageWidth = stage.width();
  const stageHeight = stage.height();
  const scale = stage.scaleX(); // Assuming uniform scaling

  // Calculate shape center
  const shapeCenterX = shape.x + (shape.w || 0) / 2;
  const shapeCenterY = shape.y + (shape.h || 0) / 2;

  // Calculate new stage position to center the shape
  const newX = stageWidth / 2 - shapeCenterX * scale;
  const newY = stageHeight / 2 - shapeCenterY * scale;

  // Smooth animation to new position
  stage.to({
    x: newX,
    y: newY,
    duration: 0.3,
    easing: Konva.Easings.EaseOut
  });
}

function addShape(type: ShapeType, colors: any, snapToGrid: boolean = false, centerOnNew: boolean = false, stageRef?: React.RefObject<Konva.Stage>) {
  // Save history before creating
  useCanvas.getState().pushHistory();
  
  const { me, shapes } = useCanvas.getState();
  
  // Helper function to apply snapping if enabled
  const applySnap = (value: number) => {
    if (!snapToGrid) return value;
    const gridSize = 25;
    return Math.round(value / gridSize) * gridSize;
  };
  
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
      x: applySnap(position.x), 
      y: applySnap(position.y), 
      w: width, 
      h: height, 
      color: "#111111", // Always dark text for canvas visibility, regardless of theme
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
      x: applySnap(position.x), 
      y: applySnap(position.y + 20), // Start point with snap
      w: defaultLength, // Use w to store length for collision detection
      h: 2, // Minimal height for collision detection  
      x2: applySnap(position.x + defaultLength), // End point with snap
      y2: applySnap(position.y + 20),
      stroke: "#111111", // Always dark stroke for canvas visibility, regardless of theme
      strokeWidth: 3,
      arrowHead: type === "arrow" ? "end" : "none",
      text: "", 
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  } else if (type === "frame") {
    // AI Image Frame - transparent background with dashed border
    const w = 200;
    const h = 150;
    const position = findBlankArea(shapes, w, h);
    
    s = { 
      id: crypto.randomUUID(), 
      type, 
      x: applySnap(position.x), 
      y: applySnap(position.y), 
      w, 
      h, 
      color: "transparent", // No fill color for frames
      stroke: "#6c757d", // Gray dashed border
      strokeWidth: 2,
      text: "", 
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  } else {
    // Other shapes - use consistent defaults and theme-aware colors
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
    
    // Use consistent sizing that matches getShapeDefaults in store.ts
    let w = 100, h = 100;
    if (type === "rect") { w = 120; h = 80; }
    else if (type === "circle") { w = 100; h = 100; }
    else if (type === "heart") { w = 90; h = 100; } // Taller for better proportions
    else if (type === "oval" || type === "trapezoid" || type === "parallelogram") { w = 120; h = 80; }
    
    const position = findBlankArea(shapes, w, h);
    
    s = { 
      id: crypto.randomUUID(), 
      type, 
      x: applySnap(position.x), 
      y: applySnap(position.y), 
      w, 
      h, 
      color,
      stroke: colors.text, // Add visible stroke for dark mode
      strokeWidth: 2, // Consistent strokeWidth for all shapes
      text: "", 
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  }
  
  useCanvas.getState().upsert(s); 
  broadcastUpsert(s); 
  // Auto-save handles persistence
  
  // Shape created successfully
  
  // Auto-select the new shape
  useCanvas.getState().select([s.id]);

  // Center on new shape if enabled
  if (centerOnNew && stageRef) {
    centerStageOnShape(s, stageRef);
  }
}



// Removed orphaned JSX code

// ChatGPT-style AI Widget - Bottom Right
function FloatingAIWidget() {
  const { colors, theme } = useTheme();
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
    // Don't set prompt value - just show placeholder text (ghost text)
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
        const errorMsg = response.message || "I couldn't understand that command. Try being more specific or check the help menu for examples.";
        setErrorMessage(errorMsg);
        // Show toast notification for better visibility
        showToast(errorMsg, 'error');
      } else if (response.type === 'clarification_needed') {
        setErrorMessage(response.message);
        // Show toast for clarification requests
        showToast(response.message || "Could you be more specific?", 'warning');
      } else {
        // Success! Show positive feedback
        if (response.message && !response.message.includes('✅')) {
          showToast(`✅ ${response.message}`, 'success');
        }
        // Clear the input after successful submission
        setPrompt('');
      }
    } catch (error) {
      console.error('AI Error:', error);
      const errorMsg = error instanceof Error 
        ? `AI Error: ${error.message}. Please check your API keys or try a simpler command.`
        : "Something went wrong while processing your request. Please try again or use a simpler command.";
      
      setErrorMessage(errorMsg);
      showToast(errorMsg, 'error');
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
          title={theme === 'halloween' ? "Open FrAInkenstein" : "Open AI Assistant"}
        >
          {theme === 'halloween' ? '🧟' : '🤖'}
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
              <span className="text-xl">{theme === 'halloween' ? '🧟' : '🤖'}</span>
              <span className="font-medium">{theme === 'halloween' ? 'FrAInkenstein' : 'AI Assistant'}</span>
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
                {theme === 'halloween' ? 'FrAInkenstein' : 'AI Assistant'} Error
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
          // Auto-save handles persistence
        });
        break;
        
      case 'right':
        targetValue = Math.max(...bounds.map(b => b.right));
        shapes.forEach(shape => {
          const updatedShape = { ...shape, x: targetValue - (shape.w || 0), updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
          useCanvas.getState().upsert(updatedShape);
          broadcastUpsert(updatedShape);
          // Auto-save handles persistence
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
          // Auto-save handles persistence
        });
        break;
        
      case 'top':
        targetValue = Math.min(...bounds.map(b => b.top));
        shapes.forEach(shape => {
          const updatedShape = { ...shape, y: targetValue, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
          useCanvas.getState().upsert(updatedShape);
          broadcastUpsert(updatedShape);
          // Auto-save handles persistence
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
          // Auto-save handles persistence
        });
        break;
        
      case 'bottom':
        targetValue = Math.max(...bounds.map(b => b.bottom));
        shapes.forEach(shape => {
          const updatedShape = { ...shape, y: targetValue - (shape.h || 0), updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
          useCanvas.getState().upsert(updatedShape);
          broadcastUpsert(updatedShape);
          // Auto-save handles persistence
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
        // Auto-save handles persistence
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
        // Auto-save handles persistence
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
    // Auto-save handles persistence
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
        id: crypto.randomUUID(), // Use proper UUID format
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
      // Auto-save handles persistence
    });
    
    // Select the new duplicates
    useCanvas.getState().select(duplicatedShapeIds);
    
    onClose();
  };

  const handleGenerateAIImage = async (frameShape: any) => {
    console.log('[FRAME] handleGenerateAIImage called with:', frameShape);
    
    if (frameShape.type !== 'frame') {
      console.error('[FRAME] Not a frame shape:', frameShape.type);
      return;
    }
    
    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      console.error('[FRAME] OpenAI API key not configured');
      alert('OpenAI API key is not configured. Please add VITE_OPENAI_API_KEY to your environment variables.');
      return;
    }
    
    const prompt = window.prompt('Enter a prompt to generate an AI image:', frameShape.aiPrompt || 'A beautiful landscape with mountains and a lake');
    if (!prompt) {
      console.log('[FRAME] User cancelled prompt');
      return;
    }
    
    console.log('[FRAME] Starting AI generation with prompt:', prompt);
    
    // Update frame to show loading state
    const loadingFrame = {
      ...frameShape,
      isGenerating: true,
      aiPrompt: prompt,
      updated_at: Date.now(),
      updated_by: useCanvas.getState().me.id
    };
    
    console.log('[FRAME] Setting loading state:', loadingFrame);
    useCanvas.getState().upsert(loadingFrame);
    broadcastUpsert(loadingFrame);
    
    try {
      console.log('[FRAME] Calling generateImageWithDALLE...');
      console.log('[FRAME] Frame dimensions:', frameShape.w, '×', frameShape.h);
      const imageUrl = await generateImageWithDALLE(prompt, frameShape.w, frameShape.h);
      console.log('[FRAME] AI generation successful, image URL:', imageUrl);
      
      // Update frame with generated image
      const updatedFrame = {
        ...frameShape,
        isGenerating: false,
        aiPrompt: prompt,
        generatedImageUrl: imageUrl,
        updated_at: Date.now(),
        updated_by: useCanvas.getState().me.id
      };
      
      console.log('[FRAME] Updating frame with generated image');
      useCanvas.getState().upsert(updatedFrame);
      broadcastUpsert(updatedFrame);
      
    } catch (error) {
      console.error('[FRAME] AI image generation failed:', error);
      console.error('[FRAME] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Reset loading state on error
      const errorFrame = {
        ...frameShape,
        isGenerating: false,
        updated_at: Date.now(),
        updated_by: useCanvas.getState().me.id
      };
      
      useCanvas.getState().upsert(errorFrame);
      broadcastUpsert(errorFrame);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`AI image generation failed: ${errorMessage}`);
    }
  };

  const handleSaveAsComponent = (shapeIds: string[]) => {
    const componentName = prompt('Enter component name:', 'My Component');
    if (!componentName || !componentName.trim()) return;
    
    const canvasState = useCanvas.getState();
    const shapesToSave = shapeIds.map(id => canvasState.shapes[id]).filter(Boolean);
    
    if (shapesToSave.length === 0) return;
    
    // Calculate bounding box to normalize positions
    const xs = shapesToSave.map(s => s.x);
    const ys = shapesToSave.map(s => s.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    
    // Normalize positions relative to top-left
    const normalizedShapes = shapesToSave.map(shape => ({
      ...shape,
      x: shape.x - minX,
      y: shape.y - minY,
      id: undefined, // Remove IDs so new ones are generated on insert
      updated_at: undefined,
      updated_by: undefined,
    }));
    
    // Store in localStorage
    try {
      const existingComponents = JSON.parse(localStorage.getItem('collabcanvas_components') || '[]');
      const newComponent = {
        id: crypto.randomUUID(),
        name: componentName.trim(),
        shapes: normalizedShapes,
        created_at: Date.now(),
      };
      existingComponents.push(newComponent);
      localStorage.setItem('collabcanvas_components', JSON.stringify(existingComponents));
      
      // Dispatch event to refresh components list
      window.dispatchEvent(new Event('componentsUpdated'));
      
      showToast(`Component "${componentName}" saved!`, 'success');
    } catch (error) {
      console.error('Failed to save component:', error);
      showToast('Failed to save component', 'error');
    }
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
          </>
        )}
        
        {/* Layer Commands - available for ALL shapes including text */}
        <hr className="my-2" style={{ borderColor: colors.border }} />
        
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
        
        {/* Duplicate - available for ALL shapes including text */}
        <button
          onClick={handleDuplicate}
          className="w-full text-left text-sm px-2 py-1 rounded"
          style={{ color: colors.text }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          📄 Duplicate
        </button>
        
        {/* Continue with shape-specific controls that were inside the conditional */}
        {shape.type !== 'text' && (
          <>
            
            {/* Group - show when multiple shapes selected */}
            {isMultiSelection && (
              <button
                onClick={() => {
                  // Save history before grouping
                  useCanvas.getState().pushHistory();
                  
                  // Group the shapes
                  const groupId = useCanvas.getState().groupShapes(shapeIds);
                  
                  if (groupId) {
                    // Broadcast group changes to multiplayer
                    const groupedShapes = useCanvas.getState().getSelectedShapes();
                    groupedShapes.forEach(shape => {
                      broadcastUpsert(shape);
                      // Auto-save handles persistence
                    });
                    
                    console.log(`Grouped ${shapeIds.length} shapes`);
                  }
                  
                  onClose();
                }}
                className="w-full text-left text-sm px-2 py-1 rounded"
                style={{ color: colors.text }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🔗 Group Shapes
              </button>
            )}
            
            {/* Ungroup - show when selected shapes contain groups */}
            {(() => {
              const hasGroupedShapes = shapes.some(shape => shape?.groupId);
              return hasGroupedShapes && (
                <button
                  onClick={() => {
                    // Find all unique group IDs in selection
                    const groupIds = new Set(
                      shapes
                        .map(shape => shape?.groupId)
                        .filter(Boolean)
                    );
                    
                    if (groupIds.size > 0) {
                      // Save history before ungrouping
                      useCanvas.getState().pushHistory();
                      
                      // Ungroup all found groups
                      groupIds.forEach(groupId => {
                        if (groupId) { // Type guard to ensure groupId is not undefined
                          const shapesToUngroup = useCanvas.getState().getGroupShapes(groupId);
                          useCanvas.getState().ungroupShapes(groupId);
                          
                          // Broadcast ungroup changes to multiplayer
                          shapesToUngroup.forEach(shape => {
                            const updatedShape = { ...shape, groupId: undefined, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
                            broadcastUpsert(updatedShape);
                            // Auto-save handles persistence
                          });
                          
                          console.log(`Ungrouped shapes from group`);
                        }
                      });
                    }
                    
                    onClose();
                  }}
                  className="w-full text-left text-sm px-2 py-1 rounded"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🔓 Ungroup Shapes
                </button>
              );
            })()}
            
            {/* Save as Component - for selected shapes */}
            {shapeIds.length > 0 && (
              <button
                onClick={() => {
                  handleSaveAsComponent(shapeIds);
                  onClose();
                }}
                className="w-full text-left text-sm px-2 py-1 rounded"
                style={{ color: colors.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                💾 Save as Component
              </button>
            )}
            
            {/* Generate AI Image - only for frame shapes */}
            {(!isMultiSelection && shape?.type === 'frame') && (
              <button
                onClick={() => {
                  handleGenerateAIImage(shape);
                  onClose();
                }}
                className="w-full text-left text-sm px-2 py-1 rounded"
                style={{ color: colors.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.buttonHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🎨 Generate AI Image
              </button>
            )}
            
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
    <Star
      x={width / 2}
      y={height / 2}
      numPoints={5}
      innerRadius={Math.min(width, height) / 4}
      outerRadius={Math.min(width, height) / 2}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
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

function CylinderShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  // Cylinder consists of a top ellipse, two vertical sides, and a bottom ellipse
  const ellipseHeight = height * 0.15; // Top/bottom ellipse height (15% of total)
  
  return (
    <>
      {/* Top ellipse */}
      <Ellipse
        x={width / 2}
        y={ellipseHeight}
        radiusX={width / 2}
        radiusY={ellipseHeight}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Main body */}
      <Rect
        x={0}
        y={ellipseHeight}
        width={width}
        height={height - ellipseHeight * 2}
        fill={fill}
        stroke="transparent" // No stroke on body, just sides
        strokeWidth={0}
      />
      {/* Left side */}
      <Line
        points={[0, ellipseHeight, 0, height - ellipseHeight]}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Right side */}
      <Line
        points={[width, ellipseHeight, width, height - ellipseHeight]}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Bottom ellipse */}
      <Ellipse
        x={width / 2}
        y={height - ellipseHeight}
        radiusX={width / 2}
        radiusY={ellipseHeight}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </>
  );
}

function DocumentShape({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  // Document shape with a folded corner (top-right)
  const foldSize = Math.min(width, height) * 0.2; // 20% fold
  const points = [
    0, 0,                          // Top left
    width - foldSize, 0,           // Top right (before fold)
    width, foldSize,               // Fold point
    width, height,                 // Bottom right
    0, height,                     // Bottom left
    0, 0                           // Close path
  ];
  
  const foldPoints = [
    width - foldSize, 0,           // Fold start
    width - foldSize, foldSize,    // Fold corner
    width, foldSize                // Fold end
  ];
  
  return (
    <>
      {/* Main document body */}
      <Line
        points={points}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        closed={true}
      />
      {/* Folded corner */}
      <Line
        points={foldPoints}
        fill="transparent"
        stroke={stroke}
        strokeWidth={strokeWidth}
        closed={false}
      />
    </>
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
  
  const queueState = OfflineQueue.getState();
  const shapesArray = Array.isArray(shapes) ? shapes : [shapes];
  const currentState = useCanvas.getState();
  
  // If offline, queue the operation instead of broadcasting
  if (!queueState.isOnline) {
    console.log('📦 Queueing upsert (offline):', shapesArray.length, 'shapes');
    OfflineQueue.queueOperation(
      'upsert',
      shapesArray,
      currentState.currentCanvas?.id || '',
      currentState.me.id
    );
    return;
  }
  
  // Online: broadcast normally
  await roomChannel.send({ type: "broadcast", event: "shape:upsert", payload: shapes });
}

async function broadcastRemove(ids: string[]) {
  if (!roomChannel) return;
  
  const queueState = OfflineQueue.getState();
  const currentState = useCanvas.getState();
  
  // If offline, queue the operation instead of broadcasting
  if (!queueState.isOnline) {
    console.log('📦 Queueing remove (offline):', ids.length, 'shapes');
    OfflineQueue.queueOperation(
      'remove',
      ids,
      currentState.currentCanvas?.id || '',
      currentState.me.id
    );
    return;
  }
  
  // Online: broadcast normally
  await roomChannel.send({ type: "broadcast", event: "shape:remove", payload: ids });
}

// DISABLED: Old debounced persistence system
// This was conflicting with the new canvasService save system
// Now using proper canvas-based saves through canvasService.saveShapesToCanvas()
// DISABLED: Old persist function - functionality moved to canvasService auto-save
// async function persist(shapes: ShapeBase | ShapeBase[]) {
//   console.log('⚠️ Old persist() system disabled - using canvasService instead');
//   // Shapes are now saved through the proper canvas save system in canvasService
// }

async function deleteFromDB(ids: string[]) {
  await supabase.from("shapes").delete().in("id", ids);
}
