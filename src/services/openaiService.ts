import OpenAI from 'openai';
import { useCanvas } from '../state/store';
import type { ShapeBase } from '../types';

// OpenAI client - will be initialized when API key is available
let openaiClient: OpenAI | null = null;

// Initialize OpenAI client
function initializeOpenAI() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (apiKey && !openaiClient) {
    openaiClient = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // We're in a browser environment
    });
  }
  return openaiClient;
}

// System prompt that teaches the AI about our canvas tools
const SYSTEM_PROMPT = `You are an AI assistant for CollabCanvas, a collaborative design tool. Users can give you natural language commands to create and manipulate shapes on a canvas.

AVAILABLE TOOLS:
1. createShape(type, x, y, w, h, color, text?) - Create rectangle, circle, or text
2. moveShape(id, x, y) - Move an existing shape to new position  
3. resizeShape(id, w, h) - Resize an existing shape
4. rotateShape(id, degrees) - Rotate shape by degrees
5. createGrid(rows, cols) - Create a grid of rectangles
6. createLoginForm() - Create a complete login form layout
7. createNavBar() - Create a navigation bar with menu items
8. createCard() - Create a card layout with title, image, description
9. arrangeHorizontally() - Arrange existing shapes in a horizontal row

CURRENT CANVAS STATE: The user has these shapes: {canvasState}

RESPONSE FORMAT: Always respond with valid JSON in this format:
{
  "intent": "create|move|resize|rotate|arrange|clarify|error",
  "confidence": 0.8,
  "actions": [
    {
      "tool": "createShape",
      "params": {
        "type": "rect|circle|text", 
        "x": 100, "y": 100, "w": 200, "h": 150,
        "color": "#ff0000", "text": "optional text content"
      }
    }
  ],
  "message": "I'll create a red rectangle for you!",
  "suggestions": ["Try: Create a blue circle", "Add text saying hello"]
}

GUIDELINES:
- Always provide helpful, encouraging responses
- If unclear, ask for clarification with specific suggestions
- Use realistic coordinates (canvas is ~800x600, start shapes around 100-400 range)
- Choose appropriate colors (use hex codes like #ff0000, #0000ff, #00ff00)
- For text shapes, make them wide enough for the content
- When arranging/moving shapes, consider their current positions
- If no shapes exist and user wants to move/resize, suggest creating shapes first

EXAMPLES:
User: "Create a red circle"
Response: {"intent": "create", "confidence": 0.9, "actions": [{"tool": "createShape", "params": {"type": "circle", "x": 200, "y": 200, "w": 100, "h": 100, "color": "#ff0000"}}], "message": "I'll create a red circle for you!", "suggestions": []}

User: "Make something blue"  
Response: {"intent": "clarify", "confidence": 0.6, "actions": [], "message": "I'd love to make something blue! What would you like me to create?", "suggestions": ["Create a blue rectangle", "Create a blue circle", "Add blue text"]}

Always be creative, helpful, and encouraging!`;

export type AIAction = {
  tool: string;
  params: Record<string, any>;
};

export type AIResponse = {
  intent: 'create' | 'move' | 'resize' | 'rotate' | 'arrange' | 'clarify' | 'error';
  confidence: number;
  actions: AIAction[];
  message: string;
  suggestions: string[];
};

export async function callOpenAI(userMessage: string): Promise<AIResponse> {
  const client = initializeOpenAI();
  
  if (!client) {
    // Fallback response when OpenAI is not available
    return {
      intent: 'error',
      confidence: 0.0,
      actions: [],
      message: 'AI service not configured. Using basic pattern matching.',
      suggestions: ['Create a red circle', 'Add text saying hello', 'Create a 2x2 grid']
    };
  }

  try {
    // Get current canvas state for context
    const canvasState = Object.values(useCanvas.getState().shapes);
    const stateDescription = canvasState.length === 0 
      ? 'empty canvas' 
      : `${canvasState.length} shapes: ${canvasState.map(s => `${s.type} at (${s.x},${s.y})`).join(', ')}`;

    const systemPrompt = SYSTEM_PROMPT.replace('{canvasState}', stateDescription);

    const completion = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: 'json_object' } // Ensure JSON response
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    // Parse and validate the JSON response
    const aiResponse: AIResponse = JSON.parse(responseText);
    
    // Validate required fields
    if (!aiResponse.intent || !aiResponse.message || !Array.isArray(aiResponse.actions)) {
      throw new Error('Invalid response format from AI');
    }

    return aiResponse;

  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Fallback to a helpful error response
    return {
      intent: 'error',
      confidence: 0.0,
      actions: [],
      message: 'I encountered an error processing your request. Could you try rephrasing?',
      suggestions: [
        'Create a red rectangle',
        'Add text saying "Hello World"',
        'Create a blue circle'
      ]
    };
  }
}

// Helper function to check if OpenAI is configured
export function isOpenAIConfigured(): boolean {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
}
