import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Text as KText, Transformer, Group, Line, RegularPolygon } from "react-konva";
import { useCanvas } from "./state/store";
import type { ShapeBase, ShapeType } from "./types";
import { supabase } from "./lib/supabaseClient";
import { interpretWithResponse, type AIResponse } from "./ai/agent";
import { isOpenAIConfigured } from "./services/openaiService";
import { isGroqConfigured } from "./services/groqService";

// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// const CANVAS_W = 2400, CANVAS_H = 1600;

// TopRibbon Component with File Menu
function TopRibbon({ onSignOut, stageRef }: { onSignOut: () => void; stageRef: React.RefObject<any> }) {
  const [showFileMenu, setShowFileMenu] = useState(false);
  const { currentCanvas, hasUnsavedChanges } = useCanvas();

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

  const handleNewCanvas = async () => {
    const canvasState = useCanvas.getState();
    const hasShapes = Object.keys(canvasState.shapes).length > 0;
    
    let proceed = true;
    if (hasShapes) {
      proceed = confirm('Create a new canvas? Current shapes will be saved to the new canvas.');
    }
    
    if (proceed) {
      try {
        const title = prompt('Enter canvas title:', 'New Canvas') || 'New Canvas';
        await canvasState.createNewCanvas(title);
      } catch (error) {
        alert('Failed to create new canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
      await canvasState.saveCurrentCanvas();
      alert('Canvas saved successfully!');
    } catch (error) {
      alert('Failed to save canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
        const switchToNew = confirm(`Canvas duplicated successfully! Switch to "${duplicatedCanvas.title}"?`);
        if (switchToNew) {
          await canvasState.loadCanvas(duplicatedCanvas.id);
        }
      } catch (error) {
        alert('Failed to duplicate canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
    setShowFileMenu(false);
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
      {/* Left side - File Menu */}
      <div className="relative">
        <button
          onClick={() => setShowFileMenu(!showFileMenu)}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          File
        </button>
        
        {showFileMenu && (
          <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              <button
                onClick={handleNewCanvas}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <span className="mr-2">📄</span>
                New Canvas
              </button>
              
              <hr className="my-1 border-gray-200" />
              
              <button
                onClick={handleSave}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <span className="mr-2">💾</span>
                Save
              </button>
              
              <button
                onClick={handleSaveAs}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <span className="mr-2">💾</span>
                Save As...
              </button>
              
              <button
                onClick={handleDuplicate}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <span className="mr-2">📋</span>
                Duplicate Canvas
              </button>
              
              <hr className="my-1 border-gray-200" />
              
              {/* Export submenu */}
              <div className="px-4 py-2">
                <div className="text-xs font-medium text-gray-500 mb-1">Export</div>
                <button
                  onClick={exportToPNG}
                  className="w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center"
                >
                  <span className="mr-2">🖼️</span>
                  Export as PNG
                </button>
                <button
                  onClick={exportToPDF}
                  className="w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center"
                >
                  <span className="mr-2">📄</span>
                  Export as PDF
                </button>
              </div>
              
              <hr className="my-1 border-gray-200" />
              
              <button
                onClick={() => {
                  setShowFileMenu(false);
                  onSignOut();
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <span className="mr-2">🚪</span>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Center - Canvas Title */}
      <div className="flex-1 text-center">
        <h1 className="text-lg font-semibold text-gray-800">CollabCanvas</h1>
      </div>

          {/* Right side - Canvas Info */}
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span className="font-medium">
              {currentCanvas?.title || 'Untitled Canvas'}
              {hasUnsavedChanges && <span className="text-orange-500 ml-1">•</span>}
            </span>
            <span className="text-gray-400">•</span>
            <span className={hasUnsavedChanges ? "text-orange-500" : "text-green-600"}>
              {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
            </span>
          </div>
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
  shapeId: string;
}

export default function Canvas({ onSignOut }: CanvasProps) {
  const { shapes, selectedIds, me, cursors, roomId } = useCanvas();
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const [_scale, setScale] = useState(1);
  const [editingText, setEditingText] = useState<{id: string, x: number, y: number, value: string} | null>(null);
  const [status, setStatus] = useState<'connecting'|'online'|'reconnecting'|'offline'>('connecting');
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const trRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

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
        const { data } = await supabase.from("shapes").select("*").eq("room_id", useCanvas.getState().roomId);
        if (data) {
          const mapped = data.map((r: any) => ({ id: r.id, type: r.type, x: r.x, y: r.y, w: r.w, h: r.h, rotation: r.rotation, color: r.color, text: r.text, updated_at: r.updated_at, updated_by: r.updated_by }));
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

  // Keyboard shortcuts (Delete/Backspace to delete, Ctrl+Z to undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts while editing text
      if (editingText) return;
      
      // Undo with Ctrl+Z
      if (e.ctrlKey && e.key === 'z') {
        useCanvas.getState().undo();
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingText]);

  const onSelect = (id: string, e:any) => {
    e.cancelBubble = true; // Prevent event from bubbling to stage
    if (e.evt.shiftKey) {
      const currentSelection = useCanvas.getState().selectedIds;
      const newSelection = [...currentSelection, id];
      const uniqueSelection = Array.from(new Set(newSelection));
      useCanvas.getState().select(uniqueSelection);
    } else {
      useCanvas.getState().select([id]);
    }
  };

  // Text editing
  const onTextDoubleClick = (id: string, e: any) => {
    const shape = useCanvas.getState().shapes[id];
    if (shape && shape.type === 'text') {
      const stage = canvasStageRef.current;
      const pos = stage.getPointerPosition();
      setEditingText({
        id,
        x: pos.x,
        y: pos.y,
        value: shape.text || ''
      });
      e.cancelBubble = true;
    }
  };

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


  // Shape elements with right-click support and styling
  const shapeEls = useMemo(() => Object.values(shapes).map((s: ShapeBase) => {
    // For text shapes, calculate dynamic dimensions
    let textWidth = s.w;
    let textHeight = s.h;
    let fontSize = s.fontSize || Math.max(16, Math.min(24, s.h * 0.6));
    
    if (s.type === 'text' && s.text) {
      const dims = getTextDimensions(s.text, fontSize);
      textWidth = dims.width;
      textHeight = dims.height;
    }
    const onClick = () => {
      if (selectedIds.includes(s.id)) {
        if (selectedIds.length === 1) {
          useCanvas.getState().select([]);
        }
      } else {
        useCanvas.getState().select([s.id]);
      }
    };

    const onRightClick = (e: any) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      setContextMenu({
        x: pointer.x,
        y: pointer.y,
        shapeId: s.id
      });
      // Select the shape when right-clicking
      useCanvas.getState().select([s.id]);
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
              fontFamily={s.fontFamily || "Arial"}
              fill={s.color || "#111"} 
              stroke={s.stroke}
              strokeWidth={s.strokeWidth || 0}
              width={textWidth}
              height={textHeight}
              wrap="word"
              ellipsis={false}
              align={isEmoji(s.text || "") ? "center" : "left"}
              verticalAlign={isEmoji(s.text || "") ? "middle" : "top"}
              onDblClick={() => {
                setEditingText({ id: s.id, x: s.x, y: s.y, value: s.text || '' });
              }}
            />
          </>
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
      </Group>
    );
  }), [shapes, selectedIds]);

  const canvasStageRef = useRef<any>(null);

  return (
    <div className="h-screen w-screen flex flex-col">
      <TopRibbon onSignOut={onSignOut} stageRef={canvasStageRef} />
      <div className="flex-1 flex">
        <Toolbar onSignOut={onSignOut} status={status} />
        <div ref={canvasContainerRef} className="flex-1 bg-slate-50 relative overflow-hidden">
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
            shapeId={contextMenu.shapeId}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </div>
    </div>
  );
}

interface ToolbarProps {
  onSignOut: () => void;
  status: 'connecting'|'online'|'reconnecting'|'offline';
}

function CategorizedToolbar() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['shapes', 'emojis']) // Start with shapes and emojis expanded
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

  const addRect = () => addShape("rect");
  const addCircle = () => addShape("circle");
  const addText = () => addShape("text");
  const addTriangle = () => addShape("triangle");
  const addStar = () => addShape("star");
  const addHeart = () => addShape("heart");
  const addPentagon = () => addShape("pentagon");
  const addHexagon = () => addShape("hexagon");
  const addOctagon = () => addShape("octagon");
  const addOval = () => addShape("oval");
  const addTrapezoid = () => addShape("trapezoid");
  const addRhombus = () => addShape("rhombus");
  const addParallelogram = () => addShape("parallelogram");
  
  const addEmoji = (emoji: string) => {
    // Save history before creating
    useCanvas.getState().pushHistory();
    
    const { me, shapes } = useCanvas.getState();
    const fontSize = 32; // Larger size for emojis
    // Emojis have inherent padding, make bounds much tighter
    const width = fontSize * 0.5; // Much tighter for visual emoji content
    const height = fontSize * 0.6; // Slightly taller to account for emoji proportions
    const position = findBlankArea(shapes, width, height);
    
    const s: ShapeBase = { 
      id: crypto.randomUUID(), 
      type: "text", 
      x: position.x, 
      y: position.y, 
      w: width, 
      h: height, 
      color: "#111", 
      text: emoji,
      fontSize: fontSize,
      updated_at: Date.now(), 
      updated_by: me.id 
    };
    
    useCanvas.getState().upsert(s); 
    broadcastUpsert(s); 
    persist(s);
  };

  const toolCategories = [
    {
      id: 'lines-arrows',
      name: 'Lines & Arrows',
      emoji: '📏',
      tools: [
        // Coming soon
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
      id: 'symbols',
      name: 'Symbols',
      emoji: '⭐',
      tools: [
        // Coming soon
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
              <div className="px-3 pb-3 border-t bg-gray-50">
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
                          px-2 py-1 text-sm rounded transition-colors flex items-center justify-center min-h-[32px]
                          ${tool.available 
                            ? 'bg-white hover:bg-blue-50 hover:text-blue-700 border border-gray-200' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }
                        `}
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
      <div className="mt-4 border-t pt-3">
        <button 
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 transition-colors text-sm font-medium w-full"
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
  
  // Clear selection when clicking on sidebar
  const handleSidebarClick = () => {
    useCanvas.getState().select([]);
  };
  
  return (
    <div className="w-64 p-4 border-r bg-white space-y-3" onClick={handleSidebarClick}>
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">CollabCanvas</div>
        <div className="flex gap-2">
          <HelpMenu />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSignOut();
            }}
            className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
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
      
      <AIBox />
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

function addShape(type: ShapeType) {
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
      color: "#111", 
      text: defaultText,
      fontSize: fontSize,
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  } else {
    // Other shapes with default colors
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
      text: "", 
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  }
  
  useCanvas.getState().upsert(s); 
  broadcastUpsert(s); 
  persist(s);
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
        <button className="px-3 py-2 rounded bg-emerald-500 text-white disabled:opacity-60 flex-1" disabled={!q||working} onClick={onRun}>
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

      <div className="mt-2 pt-2 border-t border-gray-200">
        <ClearCanvasButton />
      </div>
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
function ContextMenu({ x, y, shapeId, onClose }: {
  x: number;
  y: number;
  shapeId: string;
  onClose: () => void;
}) {
  const [showColorPicker, setShowColorPicker] = useState<'fill' | 'stroke' | null>(null);
  const shape = useCanvas(state => state.shapes[shapeId]);
  
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

  const handleDelete = () => {
    // Save history before deleting so it can be undone with all properties intact
    useCanvas.getState().pushHistory();
    
    useCanvas.getState().remove([shapeId]);
    
    // Broadcast to multiplayer
    broadcastRemove([shapeId]);
    deleteFromDB([shapeId]);
    
    onClose();
  };

  const menuStyle = {
    position: 'fixed' as const,
    left: Math.min(x, window.innerWidth - 250),
    top: Math.min(y, window.innerHeight - 200),
    zIndex: 1000,
  };

  return (
    <div style={menuStyle} className="bg-white rounded-lg shadow-lg border p-3 min-w-[200px]">
      <div className="text-sm font-medium mb-2">
        {shape.type === 'text' ? 'Text Options' : 'Shape Options'}
      </div>
      
      <div className="space-y-2">
        {/* Text-specific controls */}
        {shape.type === 'text' && (
          <>
            {/* Text Color */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Text Color:</span>
              <button
                className="w-6 h-6 rounded border border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: shape.color || '#111111' }}
                onClick={() => setShowColorPicker(showColorPicker === 'fill' ? null : 'fill')}
              />
            </div>
            
            {/* Font Size */}
            <div className="flex flex-col space-y-1">
              <span className="text-sm">Font Size:</span>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="256"
                  value={shape.fontSize || 20}
                  onChange={(e) => updateShape({ fontSize: Math.max(1, Math.min(256, parseInt(e.target.value) || 20)) })}
                  className="w-16 text-xs border rounded px-2 py-1"
                />
                <input
                  type="range"
                  min="1"
                  max="256"
                  value={shape.fontSize || 20}
                  onChange={(e) => updateShape({ fontSize: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-xs text-gray-500 w-8">px</span>
              </div>
            </div>
            
            {/* Font Family */}
            <div className="flex flex-col">
              <span className="text-sm mb-1">Font Family:</span>
              <select
                value={shape.fontFamily || "Arial"}
                onChange={(e) => updateShape({ fontFamily: e.target.value })}
                className="text-xs border rounded px-2 py-1"
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
            
            {/* Text Outline Color */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Outline Color:</span>
              <button
                className="w-6 h-6 rounded border border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: shape.stroke || '#000000' }}
                onClick={() => setShowColorPicker(showColorPicker === 'stroke' ? null : 'stroke')}
              />
            </div>
            
            {/* Text Outline Width */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Outline Width:</span>
              <input
                type="range"
                min="0"
                max="5"
                value={shape.strokeWidth || 0}
                onChange={(e) => updateShape({ strokeWidth: Number(e.target.value) })}
                className="w-16"
              />
              <span className="text-xs text-gray-500 w-6 text-center">{shape.strokeWidth || 0}</span>
            </div>
          </>
        )}
        
        {/* Shape-specific controls */}
        {shape.type !== 'text' && (
          <>
            {/* Fill Color */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Fill Color:</span>
              <button
                className="w-6 h-6 rounded border border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: shape.color }}
                onClick={() => setShowColorPicker(showColorPicker === 'fill' ? null : 'fill')}
              />
            </div>
            
            {/* Outline Color */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Outline Color:</span>
              <button
                className="w-6 h-6 rounded border border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: shape.stroke || '#000000' }}
                onClick={() => setShowColorPicker(showColorPicker === 'stroke' ? null : 'stroke')}
              />
            </div>
            
            {/* Outline Width */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Outline Width:</span>
              <input
                type="range"
                min="0"
                max="10"
                value={shape.strokeWidth || 1}
                onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                className="w-16"
              />
              <span className="text-xs text-gray-500 w-6 text-center">{shape.strokeWidth || 1}</span>
            </div>
            
            {/* Divider */}
            <hr className="my-2" />
            
            {/* Delete */}
            <button
              onClick={handleDelete}
              className="w-full text-left text-sm text-red-600 hover:bg-red-50 px-2 py-1 rounded"
            >
              Delete Shape
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
        className="px-2 py-2 text-xs border rounded bg-white hover:bg-gray-50 transition-colors cursor-pointer appearance-none pr-6"
        title="Select AI language"
      >
        {languages.map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <div className="absolute right-1 top-1/2 transform -translate-y-1/2 pointer-events-none text-xs text-gray-400">
        ▼
      </div>
    </div>
  );
}

function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const recognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const groqConfigured = isGroqConfigured();
  const openaiConfigured = isOpenAIConfigured();
  const aiConfigured = groqConfigured || openaiConfigured;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        title="Help & Examples"
      >
        ?
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          ></div>
          
          {/* Help Menu */}
          <div className="absolute left-0 top-full mt-1 w-80 bg-white border rounded-lg shadow-lg p-4 z-50 max-h-96 overflow-y-auto">
            <div className="space-y-4">
              {/* AI Command Examples */}
              <div>
                <div className="font-medium text-slate-600 mb-2">AI Agent Command Examples</div>
                {aiConfigured ? (
                  <div className="text-xs text-slate-500 space-y-1">
                    <div><strong>Create:</strong> "Make a blue dashboard with 3 cards"</div>
                    <div><strong>Move:</strong> "Move the red circle to the center"</div>
                    <div><strong>Complex:</strong> "Create a login form with styled buttons"</div>
                    <div><strong>Arrange:</strong> "Arrange all shapes in a row"</div>
                    <div><strong>Layout:</strong> "Create a navigation bar with 4 menu items"</div>
                    <div><strong>Grid:</strong> "Create a 3x3 grid of circles"</div>
                    {recognition && <div className="mt-1 text-blue-600">💬 Click 🎤 for voice input</div>}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    <strong>Basic Commands:</strong> "Create a red circle", "Add text saying hello", "Create a 2x2 grid"
                    {recognition && <span className="text-blue-600"> • Click 🎤 for voice input</span>}
                  </div>
                )}
              </div>
              
              {/* Keyboard Shortcuts */}
              <div className="border-t pt-3">
                <div className="font-medium text-slate-600 mb-2">Keyboard Shortcuts</div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Ctrl+Z</kbd> to undo</div>
                  <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Ctrl+D</kbd> to duplicate</div>
                  <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Shift+Click</kbd> to multi-select</div>
                  <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Double-click</kbd> text to edit</div>
                  <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Delete</kbd> to remove selected</div>
                  <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Mouse wheel</kbd> to zoom</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
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
