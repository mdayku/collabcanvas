import type { ShapeBase } from "../types";
import { useCanvas } from "../state/store";
import { supabase } from "../lib/supabaseClient";

export const tools = {
  createShape: (type: "rect"|"circle"|"text", x:number, y:number, w:number, h:number, color?:string, text?:string) => {
    // Save history before AI creates shapes
    useCanvas.getState().pushHistory();
    const s: ShapeBase = { id: crypto.randomUUID(), type, x, y, w, h, color, text, rotation: 0, updated_at: Date.now(), updated_by: useCanvas.getState().me.id };
    useCanvas.getState().upsert(s); broadcastUpsert(s); persist(s); return s.id;
  },
  moveShape: (id:string, x:number, y:number) => up(id, { x, y }),
  resizeShape: (id:string, w:number, h:number) => up(id, { w, h }),
  rotateShape: (id:string, deg:number) => up(id, { rotation: deg }),
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

export async function interpret(text: string) {
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
  
  // CREATION COMMANDS (enhanced)
  if (t.includes("create") && t.includes("circle")) {
    let x = 200, y = 200;
    let color = "#3b82f6"; // default blue
    
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
    
    return tools.createShape("circle", x, y, 120, 120, color);
  }
  if ((t.includes("create") && t.includes("rectangle")) || (t.includes("make") && t.includes("rectangle"))) {
    const m = t.match(/(\d+)x(\d+)/); const w = m?+m[1]:200; const h = m?+m[2]:120;
    return tools.createShape("rect", 300, 220, w, h, "#ef4444");
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
    const itemWidth = 120, itemHeight = 40;
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
async function persist(shapes: ShapeBase | ShapeBase[]) {
  const list = Array.isArray(shapes) ? shapes : [shapes];
  const rows = list.map((s) => ({ room_id: useCanvas.getState().roomId, ...s }));
  await supabase.from("shapes").upsert(rows, { onConflict: "id" });
}
