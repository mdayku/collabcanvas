import Groq from 'groq-sdk';
import { useCanvas } from '../state/store';
import type { AIAction, AIResponse } from './openaiService';

// Groq client - will be initialized when API key is available
let groqClient: Groq | null = null;

// Initialize Groq client
function initializeGroq() {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (apiKey && !groqClient) {
    groqClient = new Groq({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // We're in a browser environment
    });
  }
  return groqClient;
}

// System prompt that teaches the AI about our canvas tools
const SYSTEM_PROMPT = `You are an AI assistant for CollabCanvas, a collaborative design tool. Users can give you natural language commands to create and manipulate shapes on a canvas.

AVAILABLE TOOLS (use these tool names exactly):
1. createShape - Create shapes (rect, circle, triangle, star, heart, text, etc.)
2. moveShape - Move shape to x,y position
3. resizeShape - Change shape width and height
4. rotateShape - Rotate shape by degrees
5. changeColor - Change shape fill color
6. changeStroke - Change outline color and width
7. updateText - Change text content
8. formatText - Bold, italic, underline, text alignment
9. changeFontSize / changeFontFamily - Change font properties
10. deleteShape - Remove a shape
11. duplicateShape - Clone a shape
12. groupShapes / ungroupShapes - Group/ungroup shapes
13. alignShapes - Align shapes (left, right, center, top, middle, bottom)
14. sendToFront / sendToBack / moveUp / moveDown - Layer ordering
15. distributeShapes - Evenly space shapes (horizontal/vertical)
16. matchSize / matchPosition - Match shape dimensions or position
17. copyStyle - Copy visual style to other shapes
18. connectShapes - Create line/arrow between shapes
19. createGrid - Create NxM grid of shapes
20. undo / redo - Undo or redo actions
21. generateAIImage - Generate AI image with DALL-E for a frame shape (requires frameId and prompt)

CONTEXT: {canvasState}

IMPORTANT RULES:
- When shapes are selected and user says "make it bold/bigger/blue/etc", apply to SELECTED shapes
- Don't create new shapes if user wants to modify existing ones
- Use the exact tool names listed above
- Provide shape IDs when modifying existing shapes
- When user says "generate AI image of X", create a frame first, then call generateAIImage
- Frame creation: use createShape with type "rect", reasonable size (e.g., 400x300), light gray color
- Then immediately call generateAIImage with frameId "$LAST_CREATED" and the image prompt
- The system will replace $LAST_CREATED with the actual frame ID automatically

RESPONSE FORMAT: Always respond with valid JSON in this format:
{
  "intent": "create|move|resize|rotate|arrange|clarify|error",
  "confidence": 0.8,
  "actions": [
    {
      "name": "createShape",
      "args": {
        "type": "rect|circle|triangle|star|heart|text",
        "x": 100, "y": 100, "w": 200, "h": 150,
        "color": "#ff0000", "text": "optional"
      }
    }
  ],
  "message": "Creating a red rectangle!",
  "suggestions": ["Try: Create a blue circle"]
}

GUIDELINES:
- Use realistic coordinates (canvas ~1200x800, start shapes around 100-400)
- Provide shape IDs for modifications (get from CONTEXT above)
- Use hex color codes (#ff0000, #0000ff, #00ff00)
- Be concise, helpful, and encouraging
- If unclear, use intent: "clarify"

EXAMPLES:
User: "Create 3 blue circles"
Response: {
  "intent": "create", 
  "confidence": 0.9,
  "actions": [
    {"tool": "createShape", "params": {"type": "circle", "x": 150, "y": 200, "w": 100, "h": 100, "color": "#0000ff"}},
    {"tool": "createShape", "params": {"type": "circle", "x": 280, "y": 200, "w": 100, "h": 100, "color": "#0000ff"}},
    {"tool": "createShape", "params": {"type": "circle", "x": 410, "y": 200, "w": 100, "h": 100, "color": "#0000ff"}}
  ],
  "message": "I'll create 3 blue circles for you!",
  "suggestions": []
}

Always be creative, helpful, and encouraging!`;

const SYSTEM_PROMPTS = {
  en: `You are an AI assistant for CollabCanvas, a collaborative design tool. Users can give you natural language commands to create and manipulate shapes on a canvas.`,
  zh: `您是 CollabCanvas 的 AI 助手，这是一个协作设计工具。用户可以用自然语言命令来创建和操作画布上的形状。`,
  es: `Eres un asistente de IA para CollabCanvas, una herramienta de diseño colaborativo. Los usuarios pueden darte comandos en lenguaje natural para crear y manipular formas en un lienzo.`,
  fr: `Vous êtes un assistant IA pour CollabCanvas, un outil de conception collaborative. Les utilisateurs peuvent vous donner des commandes en langage naturel pour créer et manipuler des formes sur un canevas.`,
  de: `Sie sind ein KI-Assistent für CollabCanvas, ein kollaboratives Design-Tool. Benutzer können Ihnen natürlichsprachliche Befehle geben, um Formen auf einer Leinwand zu erstellen und zu manipulieren.`,
  ja: `あなたは協調的なデザインツールであるCollabCanvasのAIアシスタントです。ユーザーは自然言語でコマンドを与えて、キャンバス上の図形を作成・操作できます。`,
  ar: `أنت مساعد ذكي لـ CollabCanvas، أداة تصميم تعاونية. يمكن للمستخدمين إعطاؤك أوامر بلغة طبيعية لإنشاء ومعالجة الأشكال على لوحة الرسم.`
};

export async function callGroq(userMessage: string, language: string = 'en'): Promise<AIResponse> {
  const client = initializeGroq();
  
  if (!client) {
    // Fallback response when Groq is not available
    return {
      intent: 'error',
      confidence: 0.0,
      actions: [],
      message: 'Groq AI service not configured. Using basic pattern matching.',
      suggestions: ['Create a red circle', 'Add text saying hello', 'Create a 2x2 grid']
    };
  }

  try {
    // Get current canvas state for context
    const state = useCanvas.getState();
    const canvasState = Object.values(state.shapes);
    const selectedIds = state.selectedIds;
    
    const stateDescription = canvasState.length === 0 
      ? 'empty canvas' 
      : `${canvasState.length} shapes: ${canvasState.map(s => `${s.type} at (${s.x},${s.y})`).join(', ')}`;
    
    const selectionDescription = selectedIds.length === 0
      ? 'No shapes currently selected.'
      : `Currently selected: ${selectedIds.map(id => {
          const shape = state.shapes[id];
          return shape ? `${shape.type} (id: ${id}, color: ${shape.color || 'default'})` : id;
        }).join(', ')}. 
        
IMPORTANT: When user gives modification commands (like "make outline thicker", "change color", "make it bigger", etc.) and there are selected shapes, they mean to apply the modification to the SELECTED shapes UNLESS they explicitly specify a different target (like "make the red circle bigger" when a blue square is selected). Don't ask for clarification - just apply the modification to the selected shapes.`;

    const basePrompt = SYSTEM_PROMPTS[language as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.en;
    
    // Build full prompt with current canvas state
    const fullPrompt = SYSTEM_PROMPT.replace(
      '{canvasState}', 
      `Current canvas: ${stateDescription}\nSelected shapes: ${selectionDescription}`
    );
    
    const systemPrompt = fullPrompt;

    console.log('[Groq] Sending request for:', userMessage);
    
    const completion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      model: 'llama-3.1-8b-instant', // Fast, smart, free model
      max_tokens: 500,
      temperature: 0.3, // Lower for more consistent JSON
    });

    const responseText = completion.choices[0]?.message?.content;
    console.log('[Groq] Raw response:', responseText);
    
    if (!responseText) {
      throw new Error('No response from Groq');
    }

    // Parse and validate the JSON response
    let aiResponse: AIResponse;
    try {
      // Sometimes the response has markdown formatting, strip it
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
      aiResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('[Groq] JSON parse error:', parseError);
      throw new Error('Invalid JSON response from Groq');
    }
    
    console.log('[Groq] Parsed response:', aiResponse);
    
    // Validate required fields
    if (!aiResponse.intent || !aiResponse.message || !Array.isArray(aiResponse.actions)) {
      throw new Error('Invalid response format from Groq AI');
    }

    return aiResponse;

  } catch (error) {
    console.error('[Groq] API error details:', error);
    
    // More detailed error message based on error type
    let errorMessage = 'Groq AI encountered an error. Using basic pattern matching instead.';
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = '🔑 Groq API key issue. Check your configuration or using basic mode.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = '⏱️ Groq rate limit hit. Wait a moment or using basic mode.';
      } else if (error.message.includes('JSON')) {
        errorMessage = '🔧 Groq response format error. Using basic mode instead.';
      }
      console.error('[Groq] Error details:', error.message);
    }
    
    // Fallback to a helpful error response
    return {
      intent: 'error',
      confidence: 0.0,
      actions: [],
      message: errorMessage,
      suggestions: [
        'Create a red rectangle',
        'Add text saying "Hello World"',
        'Create a blue circle'
      ]
    };
  }
}

// Helper function to check if Groq is configured
export function isGroqConfigured(): boolean {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  return !!apiKey;
}
