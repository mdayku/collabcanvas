// Vercel Serverless Function for AI calls
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, canvasState } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Try Groq first (free and fast)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const response = await callGroqAPI(groqKey, message, canvasState);
        return res.json(response);
      } catch (error) {
        console.error('[API] Groq failed:', error);
        // Fall through to OpenAI
      }
    }

    // Try OpenAI as backup
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const response = await callOpenAIAPI(openaiKey, message, canvasState);
        return res.json(response);
      } catch (error) {
        console.error('[API] OpenAI failed:', error);
      }
    }

    // Fallback response
    return res.json({
      intent: 'error',
      confidence: 0.0,
      actions: [],
      message: 'AI services are currently unavailable. Using basic pattern matching.',
      suggestions: ['Create a red circle', 'Add text saying hello', 'Create a 2x2 grid']
    });

  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function callGroqAPI(apiKey, message, canvasState) {
  const stateDescription = canvasState?.length === 0 
    ? 'empty canvas' 
    : `${canvasState?.length || 0} shapes: ${canvasState?.map(s => `${s.type} at (${s.x},${s.y})`).join(', ')}`;

  const systemPrompt = SYSTEM_PROMPT.replace('{canvasState}', stateDescription);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.choices[0]?.message?.content;
  
  if (!responseText) {
    throw new Error('No response from Groq');
  }

  // Parse and clean the JSON response
  const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
  const aiResponse = JSON.parse(cleanedResponse);
  
  if (!aiResponse.intent || !aiResponse.message || !Array.isArray(aiResponse.actions)) {
    throw new Error('Invalid response format from Groq AI');
  }

  return aiResponse;
}

async function callOpenAIAPI(apiKey, message, canvasState) {
  const stateDescription = canvasState?.length === 0 
    ? 'empty canvas' 
    : `${canvasState?.length || 0} shapes: ${canvasState?.map(s => `${s.type} at (${s.x},${s.y})`).join(', ')}`;

  const systemPrompt = SYSTEM_PROMPT.replace('{canvasState}', stateDescription);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.choices[0]?.message?.content;
  
  if (!responseText) {
    throw new Error('No response from OpenAI');
  }

  const aiResponse = JSON.parse(responseText);
  
  if (!aiResponse.intent || !aiResponse.message || !Array.isArray(aiResponse.actions)) {
    throw new Error('Invalid response format from OpenAI');
  }

  return aiResponse;
}

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

Always be creative, helpful, and encouraging!`;
