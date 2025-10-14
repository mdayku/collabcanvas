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

RESPONSE FORMAT: Always respond with valid JSON in this exact format:
{
  "intent": "create",
  "confidence": 0.8,
  "actions": [
    {
      "tool": "createShape",
      "params": {
        "type": "rect", 
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
- When creating multiple shapes, space them nicely apart
- If no shapes exist and user wants to move/resize, suggest creating shapes first

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

export async function callGroq(userMessage: string): Promise<AIResponse> {
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
    const canvasState = Object.values(useCanvas.getState().shapes);
    const stateDescription = canvasState.length === 0 
      ? 'empty canvas' 
      : `${canvasState.length} shapes: ${canvasState.map(s => `${s.type} at (${s.x},${s.y})`).join(', ')}`;

    const systemPrompt = SYSTEM_PROMPT.replace('{canvasState}', stateDescription);

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
  console.log('[DEBUG] Groq API Key check:', apiKey ? `Found: ${apiKey.substring(0, 8)}...` : 'NOT FOUND');
  console.log('[DEBUG] All env vars:', import.meta.env);
  return !!apiKey;
}
