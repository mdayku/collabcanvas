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

CONTEXT: {canvasState}

IMPORTANT RULES:
- When shapes are selected and user says "make it bold/bigger/blue/etc", apply to SELECTED shapes
- Don't create new shapes if user wants to modify existing ones
- Use the exact tool names listed above
- Provide shape IDs when modifying existing shapes
- For emojis (👍, 🔥, etc.) or icons (⚙️, 📧, etc.), the rule-based parser handles them - return clarify intent
- NEVER try to draw emojis using basic shapes - they are image objects handled by the system

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
  "message": "I'll create a red rectangle for you!",
  "suggestions": ["Try: Create a blue circle"]
}

GUIDELINES:
- Use realistic coordinates (canvas ~1200x800, start shapes around 100-400)
- Provide shape IDs for modifications (get from CONTEXT above)
- Use hex color codes (#ff0000, #0000ff, #00ff00)
- For text shapes, make them wide enough for content
- Be concise, helpful, and encouraging
- If unclear, use intent: "clarify" with 2-3 specific options

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
Response: {"intent": "create", "confidence": 0.9, "actions": [{"name": "createShape", "args": {"type": "circle", "x": 200, "y": 200, "w": 100, "h": 100, "color": "#ff0000"}}], "message": "Creating a red circle!", "suggestions": []}

User: "Make something blue"  
Response: {"intent": "clarify", "confidence": 0.6, "actions": [], "message": "What should I make blue?", "suggestions": ["Create a blue rectangle", "Create a blue circle"]}

User: "make it yellow" (with text shape id:abc123 selected)
Response: {"intent": "modify", "confidence": 0.9, "actions": [{"name": "changeColor", "args": {"id": "abc123", "color": "#ffff00"}}], "message": "Making the selected text yellow!", "suggestions": []}

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

export async function callOpenAI(
  userMessage: string, 
  language: string = 'en',
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AIResponse> {
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

    console.log('[OpenAI] Sending request for:', userMessage);
    
    // Build messages array with conversation history if provided
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];
    
    if (conversationHistory && conversationHistory.length > 0) {
      console.log('[OpenAI] Including conversation history:', conversationHistory.length, 'messages');
      messages.push(...conversationHistory);
    }
    
    messages.push({ role: 'user', content: userMessage });
    
    const completion = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
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
    const rawResponse: any = JSON.parse(responseText);
    console.log('[OpenAI] Parsed response:', rawResponse);
    
    // Normalize action format: OpenAI may return {tool, params} instead of {name, args}
    let normalizedActions = rawResponse.actions || [];
    if (Array.isArray(normalizedActions)) {
      normalizedActions = normalizedActions.map((action: any) => {
        // If action has 'tool' and 'params', convert to 'name' and 'args'
        if (action.tool && action.params && !action.name && !action.args) {
          console.log('[OpenAI] Normalizing action format:', action);
          return {
            name: action.tool,
            args: action.params
          };
        }
        return action;
      });
    }
    
    const aiResponse: AIResponse = {
      intent: rawResponse.intent,
      confidence: rawResponse.confidence,
      message: rawResponse.message,
      actions: normalizedActions,
      suggestions: rawResponse.suggestions
    };
    
    // Validate required fields (actions are optional for error/clarify intents)
    if (!aiResponse.intent || !aiResponse.message) {
      throw new Error('Invalid response format from AI');
    }
    
    // Ensure actions array exists (default to empty for error/clarify)
    if (!aiResponse.actions) {
      aiResponse.actions = [];
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

  // 🚨 Check if running on localhost (AI image generation requires deployment due to CORS proxy)
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalhost) {
    console.warn('[DALL-E] ⚠️ AI image generation is not available on localhost due to CORS restrictions.');
    console.warn('[DALL-E] 💡 Deploy to Vercel to use this feature (requires /api/generate-image serverless function).');
    throw new Error('AI image generation is only available in production. Deploy your app to Vercel to use DALL-E integration.');
  }

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
