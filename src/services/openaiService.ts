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

CLARIFICATION HANDLING:
When a command is AMBIGUOUS or UNCLEAR, respond with intent: "clarify":
- Keep questions SHORT (max 15 words)
- Provide 2-3 specific options when possible
- Examples of ambiguous commands:
  * "shrink it by 200%" → "Reduce to 50% size, or make 200% larger?"
  * "move it there" → "Which shape? The circle, rectangle, or text?"
  * "make it blue" → "Make which shape blue?"
- After receiving clarification, execute the command normally
- Maximum 2 clarification rounds - then suggest rephrasing if still unclear

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

const SYSTEM_PROMPTS = {
  en: `You are an AI assistant for CollabCanvas, a collaborative design tool. Users can give you natural language commands to create and manipulate shapes on a canvas.`,
  zh: `您是 CollabCanvas 的 AI 助手，这是一个协作设计工具。用户可以用自然语言命令来创建和操作画布上的形状。`,
  es: `Eres un asistente de IA para CollabCanvas, una herramienta de diseño colaborativo. Los usuarios pueden darte comandos en lenguaje natural para crear y manipular formas en un lienzo.`,
  fr: `Vous êtes un assistant IA pour CollabCanvas, un outil de conception collaborative. Les utilisateurs peuvent vous donner des commandes en langage naturel pour créer et manipuler des formes sur un canevas.`,
  de: `Sie sind ein KI-Assistent für CollabCanvas, ein kollaboratives Design-Tool. Benutzer können Ihnen natürlichsprachliche Befehle geben, um Formen auf einer Leinwand zu erstellen und zu manipulieren.`,
  ja: `あなたは協調的なデザインツールであるCollabCanvasのAIアシスタントです。ユーザーは自然言語でコマンドを与えて、キャンバス上の図形を作成・操作できます。`,
  ar: `أنت مساعد ذكي لـ CollabCanvas، أداة تصميم تعاونية. يمكن للمستخدمين إعطاؤك أوامر بلغة طبيعية لإنشاء ومعالجة الأشكال على لوحة الرسم.`
};

export async function callOpenAI(userMessage: string, language: string = 'en'): Promise<AIResponse> {
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

    const basePrompt = SYSTEM_PROMPTS[language as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.en;
    const fullPrompt = `${basePrompt}

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

CURRENT CANVAS STATE: The user has these shapes: ${stateDescription}

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

Always be creative, helpful, and encouraging!`;
    
    const systemPrompt = fullPrompt;

    console.log('[OpenAI] Sending request for:', userMessage);
    
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
    console.log('[OpenAI] Raw response:', responseText);
    
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    // Parse and validate the JSON response
    const aiResponse: AIResponse = JSON.parse(responseText);
    console.log('[OpenAI] Parsed response:', aiResponse);
    
    // Validate required fields
    if (!aiResponse.intent || !aiResponse.message || !Array.isArray(aiResponse.actions)) {
      throw new Error('Invalid response format from AI');
    }

    return aiResponse;

  } catch (error) {
    console.error('[OpenAI] API error details:', error);
    
    // More detailed error message based on error type
    let errorMessage = 'OpenAI unavailable - using basic pattern matching instead.';
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('429')) {
        errorMessage = '💳 OpenAI quota exceeded. Add billing at platform.openai.com or using basic mode.';
      } else if (error.message.includes('API key')) {
        errorMessage = '🔑 OpenAI API key issue. Check your configuration or using basic mode.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = '⏱️ OpenAI rate limit hit. Wait a moment or using basic mode.';
      } else if (error.message.includes('JSON')) {
        errorMessage = '🔧 OpenAI response format error. Using basic mode instead.';
      }
      console.error('[OpenAI] Error details:', error.message);
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

// Helper function to check if OpenAI is configured
export function isOpenAIConfigured(): boolean {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
}

// Generate AI image using DALL-E with smart dimensions
export async function generateImageWithDALLE(prompt: string, frameWidth?: number, frameHeight?: number): Promise<string> {
  console.log('[DALL-E] 🚀 Starting AI image generation...');
  console.log('[DALL-E] Prompt:', prompt);
  console.log('[DALL-E] Frame dimensions:', frameWidth, '×', frameHeight);

  // 🎯 Try Lambda-first approach (server-side generation with no CORS issues)
  try {
    console.log('[DALL-E] 🚀 Using server-side Lambda generation...');
    
    const lambdaResponse = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        prompt, 
        frameWidth, 
        frameHeight 
      })
    });

    if (!lambdaResponse.ok) {
      const error = await lambdaResponse.json();
      throw new Error(`Lambda generation failed: ${error.error || lambdaResponse.statusText}`);
    }

    const { dataUrl, contentType, size, dalleSize: usedSize } = await lambdaResponse.json();
    
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('Invalid data URL returned from Lambda');
    }

    console.log(`[DALL-E] ✅ Image generated via Lambda (${contentType}, ${size} bytes)`);
    console.log(`[DALL-E] 📏 Used DALL-E size: ${usedSize}`);
    return dataUrl;
    
  } catch (lambdaError) {
    console.error('[DALL-E] ⚠️ Lambda generation failed:', lambdaError);
    
    // 🔄 Fallback to client-side generation if Lambda fails
    console.log('[DALL-E] 🔄 Falling back to client-side generation...');
    
    const client = initializeOpenAI();
    if (!client) {
      throw new Error('Both Lambda and client-side generation failed. OpenAI API key not configured.');
    }

    // 🎯 Smart Dimension System (fallback)
    let dalleSize: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024";
    let enhancedPrompt = prompt;
    
    if (frameWidth && frameHeight) {
      const aspectRatio = frameWidth / frameHeight;
      console.log(`[DALL-E] 📐 Frame dimensions: ${frameWidth}×${frameHeight} (ratio: ${aspectRatio.toFixed(2)})`);
      
      if (aspectRatio > 1.5) {
        dalleSize = "1792x1024";
        enhancedPrompt = prompt + ", wide panoramic composition, landscape orientation";
        console.log('[DALL-E] 🖼️ Wide frame → Using landscape 1792×1024');
      } else if (aspectRatio < 0.7) {
        dalleSize = "1024x1792";
        enhancedPrompt = prompt + ", tall vertical composition, portrait orientation";
        console.log('[DALL-E] 📱 Tall frame → Using portrait 1024×1792');
      } else {
        dalleSize = "1024x1024";
        enhancedPrompt = prompt + ", square composition, centered subject";
        console.log('[DALL-E] ⬜ Square frame → Using square 1024×1024');
      }
    }

    const fallbackResponse = await client.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: dalleSize,
      quality: "standard",
      response_format: "url"
    });

    if (!fallbackResponse.data || fallbackResponse.data.length === 0) {
      throw new Error('Fallback client-side generation failed');
    }

    const fallbackImageUrl = fallbackResponse.data[0].url;
    if (!fallbackImageUrl) {
      throw new Error('Fallback generation did not return a valid image URL');
    }

    console.log('[DALL-E] ⚠️ Using fallback URL (will have CORS issues)');
    return fallbackImageUrl;
  }
}
