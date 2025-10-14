import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Text as KText, Transformer, Group } from "react-konva";
import { useCanvas } from "./state/store";
import type { ShapeBase } from "./types";
import { supabase } from "./lib/supabaseClient";
import { interpretWithResponse, type AIResponse } from "./ai/agent";

// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// const CANVAS_W = 2400, CANVAS_H = 1600;

interface CanvasProps {
  onSignOut: () => void;
}

export default function Canvas({ onSignOut }: CanvasProps) {
  const { shapes, selectedIds, me, cursors } = useCanvas();
  const [_scale, setScale] = useState(1);
  const [editingText, setEditingText] = useState<{id: string, x: number, y: number, value: string} | null>(null);
  const trRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const stageRef = useRef<any>(null);

  // Realtime init
  useEffect(() => {
    const roomId = useCanvas.getState().roomId;
    const channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: useCanvas.getState().me.id } } });

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

    return () => { channel.unsubscribe(); };
  }, []);

  // Wheel zoom
  const onWheel = (e:any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = stageRef.current;
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
      const stage = stageRef.current;
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
      const stage = stageRef.current;
      stage.startPointerPos = stage.getPointerPosition();
      stage.startPos = { x: stage.x(), y: stage.y() };
    }
  };

  const onStageMouseMove = (_e:any) => {
    const stage = stageRef.current;
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
    const stage = stageRef.current;
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

  const shapeEls = useMemo(() => Object.values(shapes).map((s) => {
    // For text shapes, calculate dynamic dimensions
    let textWidth = s.w;
    let textHeight = s.h;
    let fontSize = s.fontSize || Math.max(16, Math.min(24, s.h * 0.6));
    
    if (s.type === 'text' && s.text) {
      const dimensions = getTextDimensions(s.text, fontSize);
      textWidth = dimensions.width;
      textHeight = dimensions.height;
    }
    
    return (
      <Group key={s.id} id={s.id}
        draggable
        x={s.x} y={s.y} rotation={s.rotation||0}
        onClick={(e)=>onSelect(s.id, e)}
        onDragEnd={(e)=>onDragEnd(s.id, e)}
        onDblClick={s.type === 'text' ? (e) => onTextDoubleClick(s.id, e) : undefined}
      >
        {s.type === "rect" && <Rect width={s.w} height={s.h} fill={s.color||"#e5e7eb"} cornerRadius={8}/>}
        {s.type === "circle" && <Circle radius={Math.max(s.w,s.h)/2} fill={s.color||"#e5e7eb"} />}
        {s.type === "text" && (
          <>
            {/* Optional background for text (subtle) */}
            <Rect 
              width={textWidth + 16} 
              height={textHeight + 8} 
              x={-8} 
              y={-4}
              fill="rgba(255,255,255,0.8)" 
              cornerRadius={4}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <KText 
              text={s.text||"text"} 
              fontSize={fontSize} 
              fill={s.color||"#111"} 
              width={textWidth}
              height={textHeight}
              wrap="word"
              ellipsis={false}
            />
          </>
        )}
      </Group>
    );
  }), [shapes]);

  return (
    <div className="h-screen w-screen flex">
      <Toolbar onSignOut={onSignOut} />
      <div className="flex-1 bg-slate-50">
        <Stage 
          width={window.innerWidth} 
          height={window.innerHeight} 
          onWheel={onWheel}
          onClick={onStageClick}
          onMouseDown={onStageMouseDown}
          onMouseMove={onStageMouseMove}
          onMouseUp={onStageMouseUp}
          ref={stageRef}
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
      </div>
    </div>
  );
}

interface ToolbarProps {
  onSignOut: () => void;
}

function Toolbar({ onSignOut }: ToolbarProps) {
  const { me, onlineUsers, cursors } = useCanvas();
  const addRect = () => addShape("rect");
  const addCircle = () => addShape("circle");
  const addText = () => addShape("text");
  
  // Clear selection when clicking on sidebar
  const handleSidebarClick = () => {
    useCanvas.getState().select([]);
  };
  
  return (
    <div className="w-64 p-4 border-r bg-white space-y-3" onClick={handleSidebarClick}>
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">CollabCanvas</div>
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
      
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded bg-slate-200" onClick={addRect}>Rectangle</button>
        <button className="px-3 py-2 rounded bg-slate-200" onClick={addCircle}>Circle</button>
        <button className="px-3 py-2 rounded bg-slate-200" onClick={addText}>Text</button>
      </div>
      <AIBox />
      <AIExamples />
      <UserTips />
    </div>
  );
}

function addShape(type: "rect"|"circle"|"text") {
  // Save history before creating
  useCanvas.getState().pushHistory();
  
  const { me } = useCanvas.getState();
  
  let s: ShapeBase;
  if (type === "text") {
    const defaultText = "Hello";
    const fontSize = 20;
    // Calculate initial dimensions based on default text
    const charWidth = fontSize * 0.6;
    const width = Math.max(80, defaultText.length * charWidth);
    const height = fontSize * 1.4;
    
    s = { 
      id: crypto.randomUUID(), 
      type, 
      x: 100 + Math.random() * 200, 
      y: 100 + Math.random() * 200, 
      w: width, 
      h: height, 
      color: "#111", 
      text: defaultText,
      fontSize: fontSize,
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  } else {
    s = { 
      id: crypto.randomUUID(), 
      type, 
      x: 100 + Math.random() * 200, 
      y: 100 + Math.random() * 200, 
      w: 200, 
      h: 120, 
      color: undefined, 
      text: "", 
      updated_at: Date.now(), 
      updated_by: me.id 
    };
  }
  
  useCanvas.getState().upsert(s); 
  broadcastUpsert(s); 
  persist(s);
}

function AIBox() {
  const [q, setQ] = useState("");
  const [working, setWorking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

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
  }, []);

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
  
  const onRun = async () => { 
    setWorking(true);
    setAiResponse(null);
    
    try {
      const response = await interpretWithResponse(q);
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
  
  return (
    <div className="mt-4 space-y-2">
      <div className="font-medium">AI Agent</div>
      
      <div className="flex gap-2">
        <input 
          className="flex-1 border rounded px-2 py-1" 
          placeholder="e.g., Create a 200x300 rectangle"
          value={q} 
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {recognition && (
          <button
            className={`px-3 py-1 rounded text-white transition-colors ${
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
        <p className="text-xs text-blue-600 animate-pulse">🎤 Listening... speak your command</p>
      )}

      <button className="px-3 py-2 rounded bg-emerald-500 text-white disabled:opacity-60" disabled={!q||working} onClick={onRun}>
        {working?"Thinking…":"Run"}
      </button>

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

      <p className="text-xs text-slate-500">
        Try: "Create a red circle", "Add text saying hello" 
        {recognition && <span className="text-blue-600">• Click 🎤 for voice input</span>}
      </p>
    </div>
  );
}

function AIExamples() {
  return (
    <div className="text-xs text-slate-500 space-y-1 border-t pt-2 mt-2">
      <div className="font-medium text-slate-600 mb-1">AI Commands:</div>
      <div className="space-y-0.5">
        <div><strong>Create:</strong> "Create a red circle"</div>
        <div><strong>Text:</strong> "Add text saying 'Hello'"</div>
        <div><strong>Move:</strong> "Move the blue rectangle to center"</div>
        <div><strong>Resize:</strong> "Make the circle twice as big"</div>
        <div><strong>Rotate:</strong> "Rotate the text 45 degrees"</div>
        <div><strong>Arrange:</strong> "Arrange shapes in horizontal row"</div>
        <div><strong>Grid:</strong> "Create a 3x3 grid"</div>
        <div><strong>Form:</strong> "Create a login form"</div>
        <div><strong>Nav:</strong> "Build a navigation bar with menu"</div>
      </div>
    </div>
  );
}

function UserTips() {
  return (
    <div className="text-xs text-slate-500 space-y-1 border-t pt-2 mt-2">
      <div className="font-medium text-slate-600 mb-1">Shortcuts:</div>
      <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Ctrl+Z</kbd> to undo</div>
      <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Ctrl+D</kbd> to duplicate</div>
      <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Shift+Click</kbd> to multi-select</div>
      <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Double-click</kbd> text to edit</div>
      <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Delete</kbd> to remove selected</div>
      <div>• <kbd className="px-1 bg-slate-200 rounded text-xs">Mouse wheel</kbd> to zoom</div>
    </div>
  );
}

// Broadcasting + persistence helpers
async function broadcastUpsert(shapes: ShapeBase | ShapeBase[]) {
  const channel = supabase.channel(`room:${useCanvas.getState().roomId}`);
  await channel.send({ type: "broadcast", event: "shape:upsert", payload: shapes });
}

async function broadcastRemove(ids: string[]) {
  const channel = supabase.channel(`room:${useCanvas.getState().roomId}`);
  await channel.send({ type: "broadcast", event: "shape:remove", payload: ids });
}

async function persist(shapes: ShapeBase | ShapeBase[]) {
  const list = Array.isArray(shapes) ? shapes : [shapes];
  const rows = list.map((s) => ({ room_id: useCanvas.getState().roomId, ...s }));
  await supabase.from("shapes").upsert(rows, { onConflict: "id" });
}

async function deleteFromDB(ids: string[]) {
  await supabase.from("shapes").delete().in("id", ids);
}
