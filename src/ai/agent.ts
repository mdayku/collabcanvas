import type { ShapeBase } from "../types";
import { useCanvas } from "../state/store";
import { supabase } from "../lib/supabaseClient";
import { callOpenAI, isOpenAIConfigured, type AIResponse as OpenAIResponse, type AIAction } from "../services/openaiService";
import { callGroq, isGroqConfigured } from "../services/groqService";
import { callServerlessAI } from "../services/serverlessAI";

// Execute AI actions using our existing tools
async function executeAIActions(actions: AIAction[]): Promise<any[]> {
  const results: any[] = [];
  
  for (const action of actions) {
    try {
      let result;
      
      switch (action.tool) {
        case 'createShape':
          result = tools.createShape(
            action.params.type,
            action.params.x,
            action.params.y, 
            action.params.w,
            action.params.h,
            action.params.color,
            action.params.text
          );
          break;
          
        case 'moveShape':
          result = tools.moveShape(action.params.id, action.params.x, action.params.y);
          break;
          
        case 'resizeShape':
          result = tools.resizeShape(action.params.id, action.params.w, action.params.h);
          break;
          
        case 'rotateShape':
          result = tools.rotateShape(action.params.id, action.params.rotation);
          break;
          
        case 'createGrid':
          const gx = action.params.rows || 2;
          const gy = action.params.cols || 2;
          const gridIds: string[] = [];
          for (let i = 0; i < gx; i++) {
            for (let j = 0; j < gy; j++) {
              const gridId = tools.createShape("rect", 80 + i * 110, 80 + j * 110, 90, 90, "#ddd");
              gridIds.push(gridId);
            }
          }
          result = gridIds;
          break;
          
        case 'createLoginForm':
          const baseX = 400, baseY = 200, gap = 60, W = 280, H = 40;
          const u = tools.createShape("rect", baseX, baseY, W, H, "#ffffff");
          const p = tools.createShape("rect", baseX, baseY + gap, W, H, "#ffffff");
          const b = tools.createShape("rect", baseX, baseY + gap * 2, W, H, "#0ea5e9");
          tools.createText("Username", baseX - 120, baseY - 26, 16, "#444");
          tools.createText("Password", baseX - 120, baseY + gap - 26, 16, "#444");
          tools.createText("Sign in", baseX + W / 2 - 34, baseY + gap * 2 + 10, 18, "#fff");
          result = [u, p, b];
          break;
          
        case 'createNavBar':
          const navBaseX = 100, navBaseY = 50, itemHeight = 40, spacing = 140;
          const navBg = tools.createShape("rect", navBaseX, navBaseY, 580, itemHeight, "#f8f9fa");
          const menuItems = ["Home", "About", "Services", "Contact"];
          const navIds = [navBg];
          menuItems.forEach((item, index) => {
            const x = navBaseX + 20 + (index * spacing);
            const textId = tools.createText(item, x, navBaseY + 8, 16, "#333");
            navIds.push(textId);
          });
          result = navIds;
          break;
          
        case 'createCard':
          const cardX = 300, cardY = 150, cardWidth = 280, cardHeight = 320;
          const container = tools.createShape("rect", cardX, cardY, cardWidth, cardHeight, "#ffffff");
          const image = tools.createShape("rect", cardX + 20, cardY + 20, cardWidth - 40, 160, "#e5e7eb");
          const title = tools.createText("Card Title", cardX + 20, cardY + 200, 20, "#111");
          const description = tools.createText("This is a card description with some sample text.", cardX + 20, cardY + 240, 14, "#666");
          result = [container, image, title, description];
          break;
          
        case 'arrangeHorizontally':
          const shapes = tools.getCanvasState();
          if (shapes.length > 0) {
            const sortedShapes = [...shapes].sort((a, b) => a.x - b.x);
            const startX = 100, arrangeSpacing = 150, baseY = 200;
            sortedShapes.forEach((shape, index) => {
              const newX = startX + (index * arrangeSpacing);
              tools.moveShape(shape.id, newX, baseY);
            });
            result = sortedShapes.map(s => s.id);
          } else {
            result = [];
          }
          break;
          
        default:
          console.warn(`Unknown AI action: ${action.tool}`);
          result = null;
      }
      
      results.push(result);
    } catch (error) {
      console.error(`Error executing AI action ${action.tool}:`, error);
      results.push(null);
    }
  }
  
  return results;
}

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

// AI Response types for better UX
export type AIResponse = {
  type: 'success' | 'clarification_needed' | 'confirmation_required' | 'error';
  message: string;
  result?: any;
  suggestions?: string[];
  confirmAction?: () => Promise<void>;
};

export async function interpretWithResponse(text: string, language: string = 'en'): Promise<AIResponse> {
  // Try serverless AI endpoint first (only in production)
  if (import.meta.env.PROD) {
    try {
      console.log('[AI] Trying serverless AI endpoint for:', text);
      const serverlessResponse = await callServerlessAI(text);
      
      // Execute actions if any
      if (serverlessResponse.actions && serverlessResponse.actions.length > 0) {
        await executeAIActions(serverlessResponse.actions);
      }
      
      // Convert serverless response to our AIResponse format
      return {
        type: serverlessResponse.intent === 'error' ? 'error' :
              serverlessResponse.intent === 'clarify' ? 'clarification_needed' : 'success',
        message: serverlessResponse.message,
        result: serverlessResponse.actions,
        suggestions: serverlessResponse.suggestions || []
      };
      
    } catch (error) {
      console.error('[AI] Serverless AI failed, trying browser-based APIs:', error);
      // Fall through to browser-based APIs
    }
  } else {
    console.log('[AI] Development mode - skipping serverless, using browser APIs');
  }

  // Try Groq browser client if configured (free and fast!)
  console.log('[DEBUG] Checking Groq configuration...');
  if (isGroqConfigured()) {
    try {
      console.log('[AI] Using browser Groq for:', text);
      const groqResponse = await callGroq(text, language);
      
      // Execute actions if any
      if (groqResponse.actions && groqResponse.actions.length > 0) {
        await executeAIActions(groqResponse.actions);
      }
      
      // Convert Groq response to our AIResponse format
      return {
        type: groqResponse.intent === 'error' ? 'error' :
              groqResponse.intent === 'clarify' ? 'clarification_needed' : 'success',
        message: groqResponse.message,
        result: groqResponse.actions,
        suggestions: groqResponse.suggestions || []
      };
      
    } catch (error) {
      console.error('[AI] Browser Groq failed, trying OpenAI:', error);
      // Fall through to OpenAI
    }
  }

  // Try OpenAI browser client as backup if configured
  console.log('[DEBUG] Checking OpenAI configuration...');
  if (isOpenAIConfigured()) {
    try {
      console.log('[AI] Using browser OpenAI for:', text);
      const openaiResponse = await callOpenAI(text, language);
      
      // Execute actions if any
      if (openaiResponse.actions && openaiResponse.actions.length > 0) {
        await executeAIActions(openaiResponse.actions);
      }
      
      // Convert OpenAI response to our AIResponse format
      return {
        type: openaiResponse.intent === 'error' ? 'error' :
              openaiResponse.intent === 'clarify' ? 'clarification_needed' : 'success',
        message: openaiResponse.message,
        result: openaiResponse.actions,
        suggestions: openaiResponse.suggestions || []
      };
      
    } catch (error) {
      console.error('[AI] Browser OpenAI failed, falling back to rule-based system:', error);
      // Fall through to rule-based system
    }
  }

  console.log('[AI] Using rule-based system for:', text);
  
  // Fallback to rule-based system
  const result = await interpret(text);
  
  if (result !== null) {
    return {
      type: 'success',
      message: `✅ Successfully executed: "${text}"`,
      result
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

// Keep the original interpret function for backward compatibility
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
async function persist(shapes: ShapeBase | ShapeBase[]) {
  const list = Array.isArray(shapes) ? shapes : [shapes];
  const rows = list.map((s) => ({ room_id: useCanvas.getState().roomId, ...s }));
  await supabase.from("shapes").upsert(rows, { onConflict: "id" });
}
