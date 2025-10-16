import type { ShapeBase } from "../types";
import { useCanvas } from "../state/store";
import { supabase } from "../lib/supabaseClient";
import { callOpenAI, isOpenAIConfigured } from "../services/openaiService";
import { callGroq, isGroqConfigured } from "../services/groqService";


export const tools = {
  createShape: (type: "rect"|"circle"|"text"|"triangle"|"star"|"heart"|"pentagon"|"hexagon"|"octagon"|"oval"|"trapezoid"|"rhombus"|"parallelogram"|"line"|"arrow"|"frame", x:number, y:number, w:number, h:number, color?:string, text?:string) => {
    // Save history before AI creates shapes
    useCanvas.getState().pushHistory();
    const s: ShapeBase = { id: crypto.randomUUID(), type, x, y, w, h, color, text, rotation: 0, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
    useCanvas.getState().upsert(s); 
    broadcastUpsert(s); 
    persist(s);
    
    // Auto-select the newly created shape so user can see what was made
    useCanvas.getState().select([s.id]);
    
    return s.id;
  },
  moveShape: (id:string, x:number, y:number) => up(id, { x, y }),
  resizeShape: (id:string, w:number, h:number) => up(id, { w, h }),
  rotateShape: (id:string, deg:number) => up(id, { rotation: deg }),
  changeColor: (id:string, color:string) => up(id, { color }),
  changeStroke: (id:string, stroke:string, strokeWidth?:number) => {
    const updates: Partial<ShapeBase> = { stroke };
    if (strokeWidth !== undefined) updates.strokeWidth = strokeWidth;
    return up(id, updates);
  },
  deleteShape: (id:string) => {
    useCanvas.getState().pushHistory();
    const shapes = useCanvas.getState().shapes;
    if (shapes[id]) {
      useCanvas.getState().remove([id]);
      broadcastRemove([id]);
      // Delete from database
      supabase.from("shapes").delete().eq("id", id);
    }
  },
  duplicateShape: (id:string) => {
    const original = useCanvas.getState().shapes[id];
    if (!original) return null;
    
    useCanvas.getState().pushHistory();
    const duplicate: ShapeBase = {
      ...original,
      id: crypto.randomUUID(),
      x: original.x + 20,
      y: original.y + 20,
      updated_at: Date.now(),
      updated_by: useCanvas.getState().me.id
    };
    
    useCanvas.getState().upsert(duplicate);
    broadcastUpsert(duplicate);
    persist(duplicate);
    useCanvas.getState().select([duplicate.id]);
    
    return duplicate.id;
  },
  groupShapes: (ids:string[]) => {
    useCanvas.getState().pushHistory();
    const groupId = useCanvas.getState().groupShapes(ids);
    return groupId;
  },
  ungroupShapes: (groupId:string) => {
    useCanvas.getState().pushHistory();
    useCanvas.getState().ungroupShapes(groupId);
  },
  alignShapes: (ids:string[], alignment: 'left'|'right'|'center'|'top'|'middle'|'bottom') => {
    if (ids.length < 2) return;
    useCanvas.getState().pushHistory();
    
    const shapes = ids.map(id => useCanvas.getState().shapes[id]).filter(Boolean);
    
    if (alignment === 'left') {
      const minX = Math.min(...shapes.map(s => s.x));
      shapes.forEach(s => up(s.id, { x: minX }));
    } else if (alignment === 'right') {
      const maxX = Math.max(...shapes.map(s => s.x + (s.w || 0)));
      shapes.forEach(s => up(s.id, { x: maxX - (s.w || 0) }));
    } else if (alignment === 'center') {
      const avgX = shapes.reduce((sum, s) => sum + s.x + (s.w || 0) / 2, 0) / shapes.length;
      shapes.forEach(s => up(s.id, { x: avgX - (s.w || 0) / 2 }));
    } else if (alignment === 'top') {
      const minY = Math.min(...shapes.map(s => s.y));
      shapes.forEach(s => up(s.id, { y: minY }));
    } else if (alignment === 'middle') {
      const avgY = shapes.reduce((sum, s) => sum + s.y + (s.h || 0) / 2, 0) / shapes.length;
      shapes.forEach(s => up(s.id, { y: avgY - (s.h || 0) / 2 }));
    } else if (alignment === 'bottom') {
      const maxY = Math.max(...shapes.map(s => s.y + (s.h || 0)));
      shapes.forEach(s => up(s.id, { y: maxY - (s.h || 0) }));
    }
  },
  createText: (text:string, x:number, y:number, fontSize:number, color?:string) => {
    // Calculate dynamic dimensions similar to the Canvas component
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
    
    const width = Math.max(Math.min(maxLineWidth, text.length * charWidth), 80);
    const height = Math.max(lines * fontSize * 1.4, fontSize * 1.2);
    
    const id = tools.createShape("text", x, y, width, height, color, text); 
    
    // Also set the fontSize property
    const shape = useCanvas.getState().shapes[id];
    if (shape) {
      const updatedShape = { ...shape, fontSize };
      useCanvas.getState().upsert(updatedShape);
      broadcastUpsert(updatedShape);
      persist(updatedShape);
      
      // Auto-select the text shape
      useCanvas.getState().select([id]);
    }
    
    return id;
  },
  getCanvasState: () => Object.values(useCanvas.getState().shapes),
};

function up(id: string, patch: Partial<ShapeBase>) {
  const prev = useCanvas.getState().shapes[id];
  if (!prev) return;
  
  // Save history before AI modifies shapes
  useCanvas.getState().pushHistory();
  
  const next = { ...prev, ...patch, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
  useCanvas.getState().upsert(next); broadcastUpsert(next); persist(next);
}

// Helper function to find shapes by color or type
function findShapeBy(criteria: { color?: string; type?: string }): ShapeBase | null {
  const shapes = tools.getCanvasState();
  
  for (const shape of shapes) {
    if (criteria.color && shape.color) {
      // Convert color to common format for comparison
      const shapeColor = shape.color.toLowerCase();
      const targetColor = criteria.color.toLowerCase();
      
      // Handle common color names
      const colorMap: Record<string, string[]> = {
        'blue': ['#3b82f6', '#0ea5e9', '#1d4ed8', 'blue'],
        'red': ['#ef4444', '#dc2626', '#b91c1c', 'red'], 
        'green': ['#10b981', '#059669', '#047857', 'green'],
        'yellow': ['#f59e0b', '#d97706', '#b45309', 'yellow'],
        'purple': ['#8b5cf6', '#7c3aed', '#6d28d9', 'purple'],
        'gray': ['#6b7280', '#4b5563', '#374151', 'gray', 'grey'],
        'black': ['#111827', '#1f2937', '#000000', 'black'],
        'white': ['#ffffff', '#f9fafb', '#f3f4f6', 'white']
      };
      
      // Check direct match
      if (shapeColor.includes(targetColor) || targetColor.includes(shapeColor)) {
        return shape;
      }
      
      // Check color name mapping
      for (const [colorName, variants] of Object.entries(colorMap)) {
        if (targetColor.includes(colorName) && variants.some(v => shapeColor.includes(v))) {
          return shape;
        }
      }
    }
    
    if (criteria.type && shape.type === criteria.type) {
      return shape;
    }
  }
  
  return null;
}

// AI Response types for better UX
export type AIResponse = {
  type: 'success' | 'clarification_needed' | 'confirmation_required' | 'error';
  message: string;
  result?: any;
  suggestions?: string[];
  confirmAction?: () => Promise<void>;
};

export async function interpretWithResponse(text: string, language: string = 'en'): Promise<AIResponse> {
  console.log('[AI] Processing command:', text);
  
  // PRIORITIZE: Try rule-based parser first for instant responses
  console.log('[AI] Trying enhanced rule-based parser first...');
  const ruleResult = await interpret(text);
  
  // If rule-based parser handled it successfully, return immediately
  if (ruleResult && typeof ruleResult === 'object' && !Array.isArray(ruleResult)) {
    if ('ok' in ruleResult && ruleResult.ok) {
      console.log('[AI] ⚡ Rule-based parser SUCCESS:', ruleResult);
      return {
        type: 'success',
        message: `✅ Successfully executed: "${text}"`,
        result: ('tool_calls' in ruleResult && ruleResult.tool_calls) ? ruleResult.tool_calls : ruleResult
      };
    }
    if ('error' in ruleResult && ruleResult.error) {
      console.log('[AI] Rule-based parser error:', ruleResult.error);
      return {
        type: 'clarification_needed',
        message: ruleResult.error,
        suggestions: [
          "Try selecting a shape first",
          "Be more specific (e.g., 'rotate the blue rectangle 45°')",
          "Create some shapes to work with"
        ]
      };
    }
  }
  
  // If rule-based parser didn't handle it, fall back to LLMs for complex commands
  console.log('[AI] Rule-based parser didn\'t handle command, trying LLMs...');
  
  // Skip serverless AI - using browser-based APIs directly

  // PRIORITY 1: Try OpenAI browser client first (primary AI service)
  console.log('[DEBUG] Checking OpenAI configuration...');
  if (isOpenAIConfigured()) {
    try {
      console.log('[AI] ⭐ Using browser OpenAI (primary) for:', text);
      const openaiResponse = await callOpenAI(text, language);
      
      // Convert OpenAI response to our AIResponse format
      return {
        type: openaiResponse.intent === 'error' ? 'error' :
              openaiResponse.intent === 'clarify' ? 'clarification_needed' : 'success',
        message: openaiResponse.message,
        result: openaiResponse.actions,
        suggestions: openaiResponse.suggestions || []
      };
      
    } catch (error) {
      console.error('[AI] ⚠️ OpenAI failed, trying Groq fallback:', error);
      
      // User-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('API key') || errorMessage.includes('401')) {
        console.error('[AI] API key issue detected');
      }
      // Fall through to Groq
    }
  } else {
    console.log('[AI] ⚠️ OpenAI not configured, skipping to Groq...');
  }

  // PRIORITY 2: Try Groq browser client as fallback (fast and free!)
  console.log('[DEBUG] Checking Groq configuration...');
  if (isGroqConfigured()) {
    try {
      console.log('[AI] 🔄 Using browser Groq (fallback) for:', text);
      const groqResponse = await callGroq(text, language);
      
      // Convert Groq response to our AIResponse format
      return {
        type: groqResponse.intent === 'error' ? 'error' :
              groqResponse.intent === 'clarify' ? 'clarification_needed' : 'success',
        message: groqResponse.message,
        result: groqResponse.actions,
        suggestions: groqResponse.suggestions || []
      };
      
    } catch (error) {
      console.error('[AI] ⚠️ Groq failed, falling back to rule-based system:', error);
      
      // User-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('API key') || errorMessage.includes('401')) {
        console.error('[AI] Groq API key issue detected');
      }
      // Fall through to rule-based system
    }
  } else {
    console.log('[AI] ⚠️ Groq not configured, skipping to legacy fallback...');
  }

  console.log('[AI] All AI services failed, using legacy rule-based fallback');
  
  // Final fallback to legacy parser
  const legacyResult = await interpretLegacy(text);
  
  if (legacyResult !== null) {
    return {
      type: 'success', 
      message: `✅ Successfully executed: "${text}"`,
      result: legacyResult
    };
  }

  // Analyze why it failed and provide helpful guidance
  const t = text.toLowerCase();
  
  // Check for ambiguous commands
  if (t.includes("create") && !t.includes("circle") && !t.includes("rectangle") && !t.includes("text") && !t.includes("grid") && !t.includes("form") && !t.includes("nav")) {
    return {
      type: 'clarification_needed',
      message: "I understand you want to create something, but what would you like to create?",
      suggestions: [
        "Create a red circle",
        "Create a 200x300 rectangle", 
        "Create text saying 'Hello'",
        "Create a 3x3 grid",
        "Create a login form"
      ]
    };
  }

  if (t.includes("move") || t.includes("resize") || t.includes("rotate")) {
    const shapes = tools.getCanvasState();
    if (shapes.length === 0) {
      return {
        type: 'clarification_needed',
        message: "I can't find any shapes to modify. Would you like to create some shapes first?",
        suggestions: [
          "Create a blue rectangle",
          "Create a red circle", 
          "Add some text first"
        ]
      };
    }
    
    return {
      type: 'clarification_needed',
      message: "I found some shapes but need more details. Which shape should I modify?",
      suggestions: [
        `Move the ${shapes[0]?.type} to center`,
        `Make the ${shapes[0]?.type} twice as big`,
        `Rotate the ${shapes[0]?.type} 45 degrees`
      ]
    };
  }

  if (t.includes("delete") || t.includes("remove") || t.includes("clear")) {
    const shapes = tools.getCanvasState();
    if (shapes.length === 0) {
      return {
        type: 'error',
        message: "There are no shapes to delete."
      };
    }
    
    return {
      type: 'confirmation_required',
      message: `⚠️ This will delete ${shapes.length} shape(s). Are you sure?`,
      confirmAction: async () => {
        // Clear all shapes
        tools.getCanvasState().forEach(shape => {
          useCanvas.getState().remove([shape.id]);
          // Note: We'd need to implement broadcastRemove and deleteFromDB functions
        });
      }
    };
  }

  // Generic "I don't understand" response
  return {
    type: 'clarification_needed',
    message: "I don't understand that command. Could you rephrase it?",
    suggestions: [
      "Create a red circle",
      "Add text saying 'Hello World'",
      "Move the blue rectangle to center",
      "Create a 2x2 grid",
      "Create a login form"
    ]
  };
}

// === NEW: Enhanced hybrid rule-based parser ===
export async function interpret(text: string) {
  const raw = text.trim();
  const t = normalize(raw);

  // 0) target resolution (selected > mentioned > last by type)
  const resolve = (hint?: Partial<Hint>) => resolveTarget({ ...extractHint(t), ...hint });

  // ROTATE
  if (/(rotate|spin|turn)\b/.test(t)) {
    const angle = parseAngle(t) ?? 90; // default 90°
    const target = resolve();
    if (!target) return { error: "No target to rotate. Select a shape or mention it (e.g., 'rotate the blue rectangle 45°')" };
    tools.rotateShape(target.id, angle);
    return { ok: true, tool_calls: [{ name:"rotateShape", args:{ id: target.id, degrees: angle }}] };
  }

  // MOVE to center / positions / relative directions
  if (/move\b/.test(t)) {
    const target = resolve();
    if (!target) return { error: "No target to move. Select a shape or mention it (e.g., 'move the circle to center')" };
    
    // Move to center
    if (/\b(center|centre|middle)\b/.test(t)) {
      const x = 400, y = 300; // Canvas center
      tools.moveShape(target.id, x, y);
      return { ok: true, tool_calls: [{ name:"moveShape", args:{ id: target.id, x, y }}] };
    }
    
    // Relative directional movement: "move right 100", "move down 250", etc.
    const relativeMove = /move\s+(right|left|up|down)\s+(\d+)/.exec(t);
    if (relativeMove) {
      const direction = relativeMove[1];
      const distance = +relativeMove[2];
      const currentShape = target.shape;
      let newX = currentShape.x;
      let newY = currentShape.y;
      
      switch (direction) {
        case 'right': newX += distance; break;
        case 'left': newX -= distance; break;
        case 'down': newY += distance; break;
        case 'up': newY -= distance; break;
      }
      
      tools.moveShape(target.id, newX, newY);
      return { ok: true, tool_calls: [{ name:"moveShape", args:{ id: target.id, x: newX, y: newY }}] };
    }
    
    // Absolute position: "move to 100 200"
    const pos = /(\d+)[ ,x]+(\d+)/.exec(t);
    if (pos) {
      const x = +pos[1], y = +pos[2];
      tools.moveShape(target.id, x, y);
      return { ok: true, tool_calls: [{ name:"moveShape", args:{ id: target.id, x, y }}] };
    }
  }

  // RESIZE (absolute or relative)
  if (/\b(resize|scale|make)\b/.test(t) && /\b(big|bigger|small|smaller|twice|half|\d+x\d+)\b/.test(t)) {
    const target = resolve();
    if (!target) return { error: "No target to resize. Select a shape or mention it (e.g., 'make the rectangle twice as big')" };
    const wh = parseSize(t, target.shape);
    tools.resizeShape(target.id, wh.w, wh.h);
    return { ok: true, tool_calls: [{ name:"resizeShape", args:{ id: target.id, ...wh }}] };
  }

  // CREATE basic shapes
  if (/create|make|add/.test(t)) {
    if (/\b(circle)\b/.test(t))  {
      const id = tools.createShape("circle", 200, 200, 120, 120, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"circle", id }}] };
    }
    if (/\b(rect|rectangle|square)\b/.test(t)) {
      const { w, h } = parseSize(t) ?? { w: 200, h: 120 };
      const id = tools.createShape("rect", 300, 220, w, h, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"rect", id }}] };
    }
    if (/\b(star)\b/.test(t)) {
      const id = tools.createShape("star", 250, 200, 100, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"star", id }}] };
    }
    if (/\b(heart)\b/.test(t)) {
      const id = tools.createShape("heart", 250, 200, 100, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"heart", id }}] };
    }
    if (/\b(triangle)\b/.test(t)) {
      const id = tools.createShape("triangle", 250, 200, 100, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"triangle", id }}] };
    }
    if (/\b(pentagon)\b/.test(t)) {
      const id = tools.createShape("pentagon", 250, 200, 100, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"pentagon", id }}] };
    }
    if (/\b(hexagon)\b/.test(t)) {
      const id = tools.createShape("hexagon", 250, 200, 100, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"hexagon", id }}] };
    }
    if (/\b(octagon)\b/.test(t)) {
      const id = tools.createShape("octagon", 250, 200, 100, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"octagon", id }}] };
    }
    if (/\b(oval|ellipse)\b/.test(t)) {
      const id = tools.createShape("oval", 250, 200, 150, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"oval", id }}] };
    }
    if (/\b(trapezoid)\b/.test(t)) {
      const id = tools.createShape("trapezoid", 250, 200, 100, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"trapezoid", id }}] };
    }
    if (/\b(rhombus|diamond)\b/.test(t)) {
      const id = tools.createShape("rhombus", 250, 200, 100, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"rhombus", id }}] };
    }
    if (/\b(parallelogram)\b/.test(t)) {
      const id = tools.createShape("parallelogram", 250, 200, 100, 100, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"parallelogram", id }}] };
    }
    if (/\b(line)\b/.test(t) && !/\btext\b/.test(t)) {
      const id = tools.createShape("line", 250, 200, 120, 2, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"line", id }}] };
    }
    if (/\b(arrow)\b/.test(t)) {
      const id = tools.createShape("arrow", 250, 200, 120, 2, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"arrow", id }}] };
    }
    if (/\b(frame)\b/.test(t) && /\b(ai|image|picture)\b/.test(t)) {
      const id = tools.createShape("frame", 250, 200, 200, 150, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"frame", id }}] };
    }
    if (/\b(text|label)\b/.test(t)) {
      const content = parseText(t) ?? "Hello World";
      const id = tools.createText(content, 180, 180, 24, parseColor(t));
      return { ok: true, tool_calls: [{ name:"createText", args:{ text: content, id }}] };
    }
  }

  // COLOR CHANGES
  if (/\b(change|make|set)\b/.test(t) && /\b(color|fill|background)\b/.test(t)) {
    const target = resolve();
    if (!target) return { error: "No target to color. Select a shape or mention it (e.g., 'make the circle red')" };
    const color = parseColor(t);
    if (color) {
      tools.changeColor(target.id, color);
      return { ok: true, tool_calls: [{ name:"changeColor", args:{ id: target.id, color }}] };
    }
  }

  // STROKE CHANGES
  if (/\b(change|add|set)\b/.test(t) && /\b(border|stroke|outline)\b/.test(t)) {
    const target = resolve();
    if (!target) return { error: "No target for border. Select a shape or mention it" };
    const color = parseColor(t);
    const widthMatch = t.match(/(\d+)\s*px/);
    const width = widthMatch ? parseInt(widthMatch[1]) : undefined;
    if (color) {
      tools.changeStroke(target.id, color, width);
      return { ok: true, tool_calls: [{ name:"changeStroke", args:{ id: target.id, stroke: color, strokeWidth: width }}] };
    }
  }

  // DELETE
  if (/\b(delete|remove|erase|clear)\b/.test(t) && !/\ball\b/.test(t)) {
    const target = resolve();
    if (!target) {
      // Try to delete selected shapes
      const selectedIds = useCanvas.getState().selectedIds;
      if (selectedIds.length > 0) {
        selectedIds.forEach(id => tools.deleteShape(id));
        return { ok: true, tool_calls: [{ name:"deleteShape", args:{ ids: selectedIds }}] };
      }
      return { error: "No target to delete. Select a shape or mention it (e.g., 'delete the red circle')" };
    }
    tools.deleteShape(target.id);
    return { ok: true, tool_calls: [{ name:"deleteShape", args:{ id: target.id }}] };
  }

  // DUPLICATE
  if (/\b(duplicate|copy|clone)\b/.test(t)) {
    const target = resolve();
    if (!target) {
      // Try to duplicate selected shapes
      const selectedIds = useCanvas.getState().selectedIds;
      if (selectedIds.length > 0) {
        const newIds = selectedIds.map(id => tools.duplicateShape(id)).filter(Boolean);
        return { ok: true, tool_calls: [{ name:"duplicateShape", args:{ ids: newIds }}] };
      }
      return { error: "No target to duplicate. Select a shape or mention it" };
    }
    const newId = tools.duplicateShape(target.id);
    return { ok: true, tool_calls: [{ name:"duplicateShape", args:{ id: newId }}] };
  }

  // ALIGN
  if (/\b(align)\b/.test(t)) {
    const selectedIds = useCanvas.getState().selectedIds;
    if (selectedIds.length < 2) {
      return { error: "Select at least 2 shapes to align" };
    }
    
    let alignment: 'left'|'right'|'center'|'top'|'middle'|'bottom' | null = null;
    if (/\b(left)\b/.test(t)) alignment = 'left';
    else if (/\b(right)\b/.test(t)) alignment = 'right';
    else if (/\b(center|horizontal)\b/.test(t)) alignment = 'center';
    else if (/\b(top)\b/.test(t)) alignment = 'top';
    else if (/\b(middle|vertical)\b/.test(t)) alignment = 'middle';
    else if (/\b(bottom)\b/.test(t)) alignment = 'bottom';
    
    if (alignment) {
      tools.alignShapes(selectedIds, alignment);
      return { ok: true, tool_calls: [{ name:"alignShapes", args:{ ids: selectedIds, alignment }}] };
    }
  }

  // GRID / ROW layout (simple)
  if (/grid/.test(t) && /(\d+)x(\d+)/.test(t)) {
    const [_, gx, gy] = t.match(/(\d+)x(\d+)/)!;
    const ids:string[] = [];
    for (let i=0;i<+gx;i++) for (let j=0;j<+gy;j++)
      ids.push(tools.createShape("rect", 80+ i*110, 80+ j*110, 90, 90, "#ddd") as any);
    return { ok: true, tool_calls: [{ name:"createGrid", args:{ gx:+gx, gy:+gy, ids }}] };
  }
  if (/\b(row|horizontal)\b/.test(t) && /\barrange|align|layout\b/.test(t)) {
    const ids = getSelectionOrAll(3); // pick first 3 by default
    if (ids.length) {
      arrangeRow(ids, 16);
      return { ok: true, tool_calls: [{ name:"arrangeRow", args:{ ids, gap:16 }}] };
    }
  }

  // SELECT shapes by various criteria
  if (/select\b/.test(t)) {
    try {
      const shapes = Object.values(useCanvas.getState().shapes);
      const color = parseColor(t);
      const type = extractHint(t).type;
      let selectedIds: string[] = [];

      // Select all shapes
      if (/\ball\s+(shapes?|objects?)\b/.test(t) || /select\s+all\b/.test(t)) {
        selectedIds = shapes.map(s => s.id);
      }
      // Select by type: "select all rectangles", "select the circles"
      else if (/\b(rectangle|rect|square)s?\b/.test(t)) {
        selectedIds = shapes.filter(s => s.type === 'rect').map(s => s.id);
      }
      else if (/\bcircles?\b/.test(t)) {
        selectedIds = shapes.filter(s => s.type === 'circle').map(s => s.id);
      }
      else if (/\b(text|labels?)\b/.test(t)) {
        selectedIds = shapes.filter(s => s.type === 'text').map(s => s.id);
      }
      else if (/\b(lines?)\b/.test(t)) {
        selectedIds = shapes.filter(s => s.type === 'line').map(s => s.id);
      }
      else if (/\b(arrows?)\b/.test(t)) {
        selectedIds = shapes.filter(s => s.type === 'arrow').map(s => s.id);
      }
      // Select by color: "select the blue circle", "select all red shapes"
      else if (color || type) {
        if (color && type) {
          // Specific color + type: "select the blue circle"
          selectedIds = shapes.filter(s => s.type === type && s.color && s.color.includes(color)).map(s => s.id);
        } else if (color) {
          // All shapes of a color: "select all red shapes"
          selectedIds = shapes.filter(s => s.color && s.color.includes(color)).map(s => s.id);
        } else if (type) {
          // All shapes of a type: "select the rectangle"
          selectedIds = shapes.filter(s => s.type === type).map(s => s.id);
        }
      }

      // Select by size: "select the largest shape", "select the smallest circle"
      if (/\b(largest|biggest)\b/.test(t)) {
        const filteredShapes = type ? shapes.filter(s => s.type === type) : shapes;
        if (filteredShapes.length > 0) {
          const largest = filteredShapes.reduce((prev, current) => 
            (prev.w * prev.h) > (current.w * current.h) ? prev : current
          );
          selectedIds = [largest.id];
        }
      }
      else if (/\b(smallest|tiniest)\b/.test(t)) {
        const filteredShapes = type ? shapes.filter(s => s.type === type) : shapes;
        if (filteredShapes.length > 0) {
          const smallest = filteredShapes.reduce((prev, current) => 
            (prev.w * prev.h) < (current.w * current.h) ? prev : current
          );
          selectedIds = [smallest.id];
        }
      }

      if (selectedIds.length > 0) {
        useCanvas.getState().select(selectedIds);
        return { 
          ok: true, 
          tool_calls: [{ 
            name: "selectShapes", 
            args: { ids: selectedIds, count: selectedIds.length } 
          }] 
        };
      } else {
        return { error: "No shapes found matching the selection criteria" };
      }
    } catch (error) {
      return { error: `Selection failed: ${(error as Error).message}` };
    }
  }

  // LOGIN FORM shortcut
  if (/login form/.test(t)) {
    const baseX = 400, baseY = 200; const gap = 60; const W=280, H=40;
    const u = tools.createShape("rect", baseX, baseY, W, H, "#ffffff");
    const p = tools.createShape("rect", baseX, baseY+gap, W, H, "#ffffff");
    const b = tools.createShape("rect", baseX, baseY+gap*2, W, H, "#0ea5e9");
    tools.createText("Username", baseX-120, baseY-26, 16, "#444");
    tools.createText("Password", baseX-120, baseY+gap-26, 16, "#444");
    tools.createText("Sign in", baseX+W/2-34, baseY+gap*2+10, 18, "#fff");
    return { ok: true, tool_calls: [{ name:"createLoginForm", args:{ ids:[u,p,b] }}] };
  }

  // FALLBACK to original parsing for compatibility
  return await interpretLegacy(text);
}

// === Rule-based parser helpers ===
type Hint = { type?: "rect"|"circle"|"text"; color?: string; selected?: boolean };

function normalize(s:string){ return s.toLowerCase().replace(/\s+/g,' ').trim(); }

function parseAngle(t:string): number | null {
  // "rotate 45", "rotate -30", "rotate 90 degrees", "rotate clockwise/counterclockwise"
  const m = t.match(/\b(-?\d{1,4})\s*(deg|degree|degrees)?\b/);
  if (m) return clampAngle(parseInt(m[1],10));
  if (/\bclockwise\b/.test(t)) return 90;
  if (/\bcounter[- ]?clockwise\b/.test(t)) return -90;
  if (/\bleft\b/.test(t)) return -90;
  if (/\bright\b/.test(t)) return 90;
  return null;
}

function clampAngle(a:number){ a%=360; if (a>180) a-=360; if (a<-180) a+=360; return a; }

function parseSize(t:string, target?: ShapeBase): { w:number; h:number } {
  const m = t.match(/(\d+)\s*[x×]\s*(\d+)/); // 200x300
  if (m) return { w:+m[1], h:+m[2] };
  if (/\btwice|2x|double\b/.test(t) && target) return { w: target.w*2, h: target.h*2 };
  if (/\bhalf|0\.5x\b/.test(t) && target)        return { w: Math.max(10,target.w/2), h: Math.max(10,target.h/2) };
  if (/\b(bigger|larger)\b/.test(t) && target)   return { w: target.w*1.25, h: target.h*1.25 };
  if (/\b(smaller|shrink)\b/.test(t) && target)  return { w: target.w*0.8,  h: target.h*0.8  };
  return { w: 200, h: 120 };
}

function parseColor(t:string): string | undefined {
  const m = t.match(/\b(red|blue|green|yellow|purple|orange|black|white|gray|grey)\b/);
  if (!m) return undefined;
  const map:any = { 
    red:"#ef4444", blue:"#3b82f6", green:"#10b981", yellow:"#f59e0b", 
    purple:"#8b5cf6", orange:"#f97316", black:"#111827", white:"#ffffff", 
    gray:"#6b7280", grey:"#6b7280" 
  };
  return map[m[1]];
}

function parseText(t:string): string | null {
  const m = t.match(/(?:say|text|label|that says)\s+["']([^"']+)["']/) || t.match(/["']([^"']+)["']/);
  return m?.[1] ?? null;
}

function getSelectionOrAll(n=0): string[] {
  const s = useCanvas.getState(); 
  const ids = s.selectedIds.length ? s.selectedIds : Object.keys(s.shapes);
  return n ? ids.slice(0,n) : ids;
}

function resolveTarget(hint?: Partial<Hint>): { id:string; shape: ShapeBase } | null {
  const s = useCanvas.getState();
  
  // Prefer currently selected shapes
  if (s.selectedIds.length) {
    const id = s.selectedIds[0]; 
    return { id, shape: s.shapes[id] };
  }
  
  // by explicit type words
  if (hint?.type) {
    const found = Object.values(s.shapes).find(x => x.type === hint!.type); 
    if (found) return { id: found.id, shape: found };
  }
  
  // by color mention (e.g., "blue rectangle")
  if (hint?.color) {
    const found = Object.values(s.shapes).find(x => x.color && x.color.includes(hint!.color!)); 
    if (found) return { id: found.id, shape: found };
  }
  
  // last created as fallback
  const last = Object.values(s.shapes).sort((a,b)=>b.updated_at-a.updated_at)[0];
  return last ? { id: last.id, shape: last } : null;
}

function extractHint(t:string): Hint {
  const type = /\b(rect|rectangle)\b/.test(t) ? "rect" : 
               /\bcircle\b/.test(t) ? "circle" : 
               /\btext|label\b/.test(t) ? "text" : undefined;
  const c = parseColor(t);
  return { type, color: c };
}

// Simple row layout
function arrangeRow(ids:string[], gap=12) {
  const s = useCanvas.getState();
  let x = 80, y = 200;
  ids.forEach((id) => {
    const sh = s.shapes[id]; if (!sh) return;
    up(id, { x: x, y }); 
    x += (sh.w + gap);
  });
}

// LEGACY: Keep original interpret function for backward compatibility
async function interpretLegacy(text: string) {
  const t = text.toLowerCase();
  
  // MANIPULATION COMMANDS - Move existing shapes
  if (t.includes("move") && (t.includes("to") || t.includes("center"))) {
    let targetShape: ShapeBase | null = null;
    
    // Find shape by color
    const colorMatch = t.match(/(blue|red|green|yellow|purple|gray|grey|black|white)/);
    if (colorMatch) {
      targetShape = findShapeBy({ color: colorMatch[1] });
    }
    
    // Find shape by type if no color match
    if (!targetShape) {
      if (t.includes("rectangle") || t.includes("rect")) {
        targetShape = findShapeBy({ type: "rect" });
      } else if (t.includes("circle")) {
        targetShape = findShapeBy({ type: "circle" });
      } else if (t.includes("text")) {
        targetShape = findShapeBy({ type: "text" });
      }
    }
    
    if (targetShape) {
      let newX = targetShape.x, newY = targetShape.y;
      
      // Parse target position
      if (t.includes("center")) {
        newX = 400; // Canvas center X
        newY = 300; // Canvas center Y
      } else {
        // Look for position coordinates
        const posMatch = t.match(/(?:position\s+)?(\d+),?\s*(\d+)/);
        if (posMatch) {
          newX = parseInt(posMatch[1]);
          newY = parseInt(posMatch[2]);
        }
      }
      
      tools.moveShape(targetShape.id, newX, newY);
      return targetShape.id;
    }
  }
  
  // MANIPULATION COMMANDS - Resize existing shapes
  if (t.includes("resize") || (t.includes("make") && (t.includes("bigger") || t.includes("smaller") || t.includes("twice")))) {
    let targetShape: ShapeBase | null = null;
    
    // Find shape by type or color
    const colorMatch = t.match(/(blue|red|green|yellow|purple|gray|grey|black|white)/);
    if (colorMatch) {
      targetShape = findShapeBy({ color: colorMatch[1] });
    }
    
    if (!targetShape) {
      if (t.includes("circle")) {
        targetShape = findShapeBy({ type: "circle" });
      } else if (t.includes("rectangle") || t.includes("rect")) {
        targetShape = findShapeBy({ type: "rect" });
      } else if (t.includes("text")) {
        targetShape = findShapeBy({ type: "text" });
      }
    }
    
    if (targetShape) {
      let factor = 1;
      
      // Parse resize factor
      if (t.includes("twice") || t.includes("2x") || t.includes("double")) {
        factor = 2;
      } else if (t.includes("half") || t.includes("0.5")) {
        factor = 0.5;
      } else if (t.includes("three times") || t.includes("3x")) {
        factor = 3;
      } else {
        // Look for explicit factor
        const factorMatch = t.match(/(\d+(?:\.\d+)?)\s*times/);
        if (factorMatch) {
          factor = parseFloat(factorMatch[1]);
        }
      }
      
      const newW = targetShape.w * factor;
      const newH = targetShape.h * factor;
      tools.resizeShape(targetShape.id, newW, newH);
      return targetShape.id;
    }
  }
  
  // MANIPULATION COMMANDS - Rotate existing shapes
  if (t.includes("rotate")) {
    let targetShape: ShapeBase | null = null;
    
    // Find shape by type or color
    const colorMatch = t.match(/(blue|red|green|yellow|purple|gray|grey|black|white)/);
    if (colorMatch) {
      targetShape = findShapeBy({ color: colorMatch[1] });
    }
    
    if (!targetShape) {
      if (t.includes("text")) {
        targetShape = findShapeBy({ type: "text" });
      } else if (t.includes("rectangle") || t.includes("rect")) {
        targetShape = findShapeBy({ type: "rect" });
      } else if (t.includes("circle")) {
        targetShape = findShapeBy({ type: "circle" });
      }
    }
    
    if (targetShape) {
      let degrees = 0;
      
      // Parse rotation angle
      const angleMatch = t.match(/(\d+)\s*degrees?/);
      if (angleMatch) {
        degrees = parseInt(angleMatch[1]);
      }
      
      tools.rotateShape(targetShape.id, degrees);
      return targetShape.id;
    }
  }
  
  // CREATION COMMANDS (enhanced with quantity support)
  if ((t.includes("create") || t.includes("draw") || t.includes("make")) && t.includes("circle")) {
    let x = 200, y = 200;
    let color = "#3b82f6"; // default blue
    let count = 1; // default single shape
    
    // Parse quantity (numbers and words)
    const numberWords: Record<string, number> = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    // Check for number words first
    for (const [word, num] of Object.entries(numberWords)) {
      if (t.includes(word)) {
        count = num;
        break;
      }
    }
    
    // Check for digit numbers
    const digitMatch = t.match(/(\d+)\s+(?:blue|red|green|yellow|purple|gray|grey|black|white|)\s*circles?/);
    if (digitMatch) {
      count = parseInt(digitMatch[1]);
    }
    
    // Parse position if specified
    const posMatch = t.match(/(?:at\s+)?position\s+(\d+),?\s*(\d+)/);
    if (posMatch) {
      x = parseInt(posMatch[1]);
      y = parseInt(posMatch[2]);
    }
    
    // Parse color if specified
    const colorMatch = t.match(/(red|blue|green|yellow|purple|gray|grey|black|white)/);
    if (colorMatch) {
      const colorMap: Record<string, string> = {
        'red': '#ef4444',
        'blue': '#3b82f6', 
        'green': '#10b981',
        'yellow': '#f59e0b',
        'purple': '#8b5cf6',
        'gray': '#6b7280',
        'grey': '#6b7280',
        'black': '#111827',
        'white': '#ffffff'
      };
      color = colorMap[colorMatch[1]] || color;
    }
    
    // Create multiple shapes with spacing
    const ids: string[] = [];
    const spacing = 140; // Distance between shapes
    
    for (let i = 0; i < Math.min(count, 10); i++) { // Limit to max 10 shapes
      const offsetX = x + (i % 5) * spacing; // Arrange in rows of 5
      const offsetY = y + Math.floor(i / 5) * spacing;
      const id = tools.createShape("circle", offsetX, offsetY, 120, 120, color);
      ids.push(id);
    }
    
    return ids.length === 1 ? ids[0] : ids;
  }
  if ((t.includes("create") || t.includes("draw") || t.includes("make")) && (t.includes("rectangle") || t.includes("rect"))) {
    let count = 1;
    let color = "#ef4444"; // default red
    
    // Parse quantity
    const numberWords: Record<string, number> = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    for (const [word, num] of Object.entries(numberWords)) {
      if (t.includes(word)) {
        count = num;
        break;
      }
    }
    
    const digitMatch = t.match(/(\d+)\s+(?:blue|red|green|yellow|purple|gray|grey|black|white|)\s*rectangles?/);
    if (digitMatch) {
      count = parseInt(digitMatch[1]);
    }
    
    // Parse color
    const colorMatch = t.match(/(red|blue|green|yellow|purple|gray|grey|black|white)/);
    if (colorMatch) {
      const colorMap: Record<string, string> = {
        'red': '#ef4444', 'blue': '#3b82f6', 'green': '#10b981',
        'yellow': '#f59e0b', 'purple': '#8b5cf6', 'gray': '#6b7280',
        'grey': '#6b7280', 'black': '#111827', 'white': '#ffffff'
      };
      color = colorMap[colorMatch[1]] || color;
    }
    
    // Parse dimensions
    const m = t.match(/(\d+)x(\d+)/); 
    const w = m ? +m[1] : 200; 
    const h = m ? +m[2] : 120;
    
    // Create multiple rectangles
    const ids: string[] = [];
    const spacing = 140;
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const offsetX = 300 + (i % 5) * spacing;
      const offsetY = 220 + Math.floor(i / 5) * spacing;
      const id = tools.createShape("rect", offsetX, offsetY, w, h, color);
      ids.push(id);
    }
    
    return ids.length === 1 ? ids[0] : ids;
  }
  if (t.includes("text") || t.includes("layer")) {
    let content = "Hello World";
    
    // Try multiple patterns to extract text content
    const patterns = [
      /say[s]?\s+['\"]([^'\"]+)['\"]/i,           // "says 'text'" 
      /that says\s+['\"]([^'\"]+)['\"]/i,         // "that says 'text'"
      /that says\s+(.+?)(?:\.|$)/i,              // "that says text" (ending with period or end)
      /layer that says\s+(.+?)(?:\.|$)/i,        // "layer that says text"
      /with (?:the word[s]?\s+)?['\"]([^'\"]+)['\"]/i, // "with the word 'text'" or "with 'text'"
      /containing\s+['\"]([^'\"]+)['\"]/i,        // "containing 'text'"
      /reading\s+['\"]([^'\"]+)['\"]/i,           // "reading 'text'"
      /labeled\s+['\"]([^'\"]+)['\"]/i,           // "labeled 'text'"
      /['\"]([^'\"]+)['\"](?:\s+in\s+it)?/i       // "'text' in it" or just "'text'"
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]?.trim()) {
        content = match[1].trim();
        break;
      }
    }
    
    return tools.createText(content, 180, 180, 24, "#111");
  }
  if (t.includes("grid") && t.match(/(\d+)x(\d+)/)) {
    const mm = t.match(/(\d+)x(\d+)/)!; const gx = +mm[1], gy = +mm[2];
    const ids:string[] = [];
    for (let i=0;i<gx;i++) for (let j=0;j<gy;j++) ids.push(tools.createShape("rect", 80+ i*110, 80+ j*110, 90, 90, "#ddd"));
    return ids;
  }
  // LAYOUT COMMANDS - Arrange existing shapes
  if (t.includes("arrange") && (t.includes("horizontal") || t.includes("row"))) {
    const shapes = tools.getCanvasState();
    if (shapes.length > 0) {
      // Sort shapes by their current x position
      const sortedShapes = [...shapes].sort((a, b) => a.x - b.x);
      
      // Arrange in horizontal row with equal spacing
      const startX = 100;
      const spacing = 150;
      const baseY = 200; // Align all shapes to same Y
      
      sortedShapes.forEach((shape, index) => {
        const newX = startX + (index * spacing);
        tools.moveShape(shape.id, newX, baseY);
      });
      
      return sortedShapes.map(s => s.id);
    }
  }
  
  if (t.includes("navigation bar") || (t.includes("nav") && t.includes("menu"))) {
    const baseX = 100, baseY = 50;
    const itemHeight = 40;
    const spacing = 140;
    
    // Create navigation background
    const navBg = tools.createShape("rect", baseX, baseY, 580, itemHeight, "#f8f9fa");
    
    // Create 4 menu items
    const menuItems = ["Home", "About", "Services", "Contact"];
    const ids = [navBg];
    
    menuItems.forEach((item, index) => {
      const x = baseX + 20 + (index * spacing);
      const textId = tools.createText(item, x, baseY + 8, 16, "#333");
      ids.push(textId);
    });
    
    return ids;
  }
  
  if (t.includes("card layout") || (t.includes("card") && (t.includes("title") || t.includes("image") || t.includes("description")))) {
    const baseX = 300, baseY = 150;
    const cardWidth = 280, cardHeight = 320;
    
    // Create card container
    const container = tools.createShape("rect", baseX, baseY, cardWidth, cardHeight, "#ffffff");
    
    // Create image placeholder
    const image = tools.createShape("rect", baseX + 20, baseY + 20, cardWidth - 40, 160, "#e5e7eb");
    
    // Create title
    const title = tools.createText("Card Title", baseX + 20, baseY + 200, 20, "#111");
    
    // Create description
    const description = tools.createText("This is a card description with some sample text content.", baseX + 20, baseY + 240, 14, "#666");
    
    return [container, image, title, description];
  }
  
  if (t.includes("login form")) {
    const baseX = 400, baseY = 200; const gap = 60; const W=280, H=40;
    const u = tools.createShape("rect", baseX, baseY, W, H, "#ffffff");
    const p = tools.createShape("rect", baseX, baseY+gap, W, H, "#ffffff");
    const b = tools.createShape("rect", baseX, baseY+gap*2, W, H, "#0ea5e9");
    tools.createText("Username", baseX-120, baseY-26, 16, "#444");
    tools.createText("Password", baseX-120, baseY+gap-26, 16, "#444");
    tools.createText("Sign in", baseX+W/2-34, baseY+gap*2+10, 18, "#fff");
    return [u,p,b];
  }
  return null;
}

async function broadcastUpsert(shapes: ShapeBase | ShapeBase[]) {
  const channel = supabase.channel(`room:${useCanvas.getState().roomId}`);
  await channel.send({ type: "broadcast", event: "shape:upsert", payload: shapes });
}
async function broadcastRemove(ids: string[]) {
  const channel = supabase.channel(`room:${useCanvas.getState().roomId}`);
  await channel.send({ type: "broadcast", event: "shape:remove", payload: { ids } });
}
async function persist(shapes: ShapeBase | ShapeBase[]) {
  const list = Array.isArray(shapes) ? shapes : [shapes];
  const rows = list.map((s) => ({ room_id: useCanvas.getState().roomId, ...s }));
  await supabase.from("shapes").upsert(rows, { onConflict: "id" });
}
