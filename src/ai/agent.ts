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

export async function interpret(text: string) {
  const t = text.toLowerCase();
  if (t.includes("create") && t.includes("circle")) {
    return tools.createShape("circle", 200, 200, 120, 120, "#3b82f6");
  }
  if (t.includes("create") && t.includes("rectangle")) {
    const m = t.match(/(\d+)x(\d+)/); const w = m?+m[1]:200; const h = m?+m[2]:120;
    return tools.createShape("rect", 300, 220, w, h, "#ef4444");
  }
  if (t.includes("text")) {
    let content = "Hello World";
    
    // Try multiple patterns to extract text content
    const patterns = [
      /say[s]?\s+['\"]([^'\"]+)['\"]/i,           // "says 'text'" 
      /that says\s+['\"]([^'\"]+)['\"]/i,         // "that says 'text'"
      /that says\s+(.+?)(?:\s|$)/i,              // "that says text"
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
