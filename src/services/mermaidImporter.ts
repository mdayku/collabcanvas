/**
 * Mermaid Diagram Importer
 * Converts parsed Mermaid diagrams into CollabCanvas shapes
 */

import type { ShapeBase } from '../types';
import { parseMermaidFlowchart, layoutDiagram, type MermaidDiagram } from './mermaidParser';

export interface ImportResult {
  shapes: ShapeBase[];
  success: boolean;
  error?: string;
}

/**
 * Import Mermaid diagram from markdown text
 */
export function importMermaidDiagram(
  markdown: string,
  userId: string,
  colors: { primary: string; text: string }
): ImportResult {
  try {
    // Parse diagram
    const diagram = parseMermaidFlowchart(markdown);
    
    if (!diagram) {
      return {
        shapes: [],
        success: false,
        error: 'No valid Mermaid diagram found in the provided text'
      };
    }
    
    if (diagram.nodes.size === 0) {
      return {
        shapes: [],
        success: false,
        error: 'Diagram contains no nodes'
      };
    }
    
    // Layout nodes
    const layout = layoutDiagram(diagram);
    
    // Create shapes
    const shapes: ShapeBase[] = [];
    let zIndex = 0;
    
    // Create node shapes (backgrounds first, text on top)
    for (const [nodeId, node] of diagram.nodes) {
      const pos = layout.get(nodeId);
      if (!pos) continue;
      
      // Create background shape
      const shape: ShapeBase = {
        id: crypto.randomUUID(),
        type: node.shapeType,
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        color: getShapeColor(node.shapeType, colors.primary),
        stroke: '#000000',
        strokeWidth: 2,
        updated_at: Date.now(),
        updated_by: userId,
        zIndex: zIndex++
      };
      
      shapes.push(shape);
      
      // Create text label on top of shape
      if (node.text) {
        const textShape: ShapeBase = {
          id: crypto.randomUUID(),
          type: 'text',
          x: pos.x + pos.w / 2 - 40, // Center text (approximate)
          y: pos.y + pos.h / 2 - 10,  // Center vertically
          w: 80,
          h: 20,
          text: node.text,
          fontSize: 14,
          color: '#FFFFFF', // White text for better visibility on colored shapes
          stroke: '#000000', // Black outline for contrast
          strokeWidth: 1,
          textAlign: 'center',
          updated_at: Date.now(),
          updated_by: userId,
          zIndex: zIndex++
        };
        
        shapes.push(textShape);
      }
    }
    
    // Map node IDs to their background shapes (not text) for arrow connections
    const nodeIdToShape = new Map<string, ShapeBase>();
    for (const [nodeId, node] of diagram.nodes) {
      const pos = layout.get(nodeId);
      if (!pos) continue;
      
      // Find the background shape (not text type) at this position
      const shape = shapes.find(s => 
        s.type !== 'text' && 
        s.x === pos.x && 
        s.y === pos.y
      );
      
      if (shape) {
        nodeIdToShape.set(nodeId, shape);
      }
    }
    
    for (const conn of diagram.connections) {
      const fromShape = nodeIdToShape.get(conn.from);
      const toShape = nodeIdToShape.get(conn.to);
      
      if (!fromShape || !toShape) continue;
      
      // Calculate arrow endpoints (center to center for now)
      const fromX = fromShape.x + fromShape.w / 2;
      const fromY = fromShape.y + fromShape.h / 2;
      const toX = toShape.x + toShape.w / 2;
      const toY = toShape.y + toShape.h / 2;
      
      const arrow: ShapeBase = {
        id: crypto.randomUUID(),
        type: 'arrow',
        x: fromX,
        y: fromY,
        w: toX - fromX,
        h: toY - fromY,
        x2: toX,
        y2: toY,
        color: '#000000',
        stroke: '#000000',
        strokeWidth: conn.lineType === 'thick' ? 3 : 2,
        updated_at: Date.now(),
        updated_by: userId,
        zIndex: zIndex++
      };
      
      shapes.push(arrow);
      
      // Add label if present
      if (conn.label) {
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        
        const label: ShapeBase = {
          id: crypto.randomUUID(),
          type: 'text',
          x: midX - 30,
          y: midY - 10,
          w: 60,
          h: 20,
          text: conn.label,
          fontSize: 12,
          color: '#000000', // Black text for connection labels
          updated_at: Date.now(),
          updated_by: userId,
          zIndex: zIndex++
        };
        
        shapes.push(label);
      }
    }
    
    return {
      shapes,
      success: true
    };
    
  } catch (error) {
    return {
      shapes: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during import'
    };
  }
}

/**
 * Get appropriate color for shape type
 */
function getShapeColor(shapeType: string, primaryColor: string): string {
  const colorMap: Record<string, string> = {
    'rect': '#3b82f6',        // Blue
    'roundedRect': '#8b5cf6', // Purple
    'stadium': '#10b981',     // Green
    'circle': '#f59e0b',      // Orange
    'rhombus': '#ef4444',     // Red (decision)
    'hexagon': '#06b6d4',     // Cyan
    'cylinder': '#84cc16',    // Lime (database)
    'trapezoid': '#ec4899',   // Pink
  };
  
  return colorMap[shapeType] || primaryColor;
}

/**
 * Validate if text contains Mermaid diagram
 */
export function containsMermaidDiagram(text: string): boolean {
  return /```mermaid|graph\s+(TD|LR|BT|RL)|flowchart\s+(TD|LR|BT|RL)/i.test(text);
}

