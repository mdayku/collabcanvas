import { useCanvas } from '../state/store';
import type { AIResponse } from './openaiService';

// Call our serverless AI API endpoint
export async function callServerlessAI(userMessage: string): Promise<AIResponse> {
  try {
    // Get current canvas state for context
    const canvasState = Object.values(useCanvas.getState().shapes);
    
    console.log('[ServerlessAI] Sending request to /api/ai for:', userMessage);
    
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        canvasState: canvasState
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const aiResponse: AIResponse = await response.json();
    console.log('[ServerlessAI] Received response:', aiResponse);
    
    // Validate required fields
    if (!aiResponse.intent || !aiResponse.message || !Array.isArray(aiResponse.actions)) {
      throw new Error('Invalid response format from serverless AI API');
    }

    return aiResponse;

  } catch (error) {
    console.error('[ServerlessAI] API error:', error);
    
    // Return a helpful error response
    return {
      intent: 'error',
      confidence: 0.0,
      actions: [],
      message: '🔧 Serverless AI unavailable. Falling back to client-side AI or basic mode.',
      suggestions: [
        'Create a red rectangle',
        'Add text saying "Hello World"',
        'Create a blue circle'
      ]
    };
  }
}

// Check if the serverless API is available
export async function isServerlessAIAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'test',
        canvasState: []
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.warn('[ServerlessAI] Availability check failed:', error);
    return false;
  }
}
