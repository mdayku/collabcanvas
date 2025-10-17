/**
 * Mermaid Flowchart Parser
 * Parses Mermaid diagram syntax and converts to CollabCanvas shapes
 * 
 * Supported syntax:
 * - graph TD/LR (top-down, left-right)
 * - Node types: [rect], (stadium), {diamond}, ([rounded]), etc.
 * - Connections: -->, ---|text|-->, -.->
 */

import type { ShapeType } from '../types';

export interface MermaidNode {
  id: string;
  text: string;
  shapeType: ShapeType;
}

export interface MermaidConnection {
  from: string;
  to: string;
  label?: string;
  lineType: 'solid' | 'dashed' | 'thick';
}

export interface MermaidDiagram {
  direction: 'TD' | 'LR' | 'BT' | 'RL'; // Top-Down, Left-Right, Bottom-Top, Right-Left
  nodes: Map<string, MermaidNode>;
  connections: MermaidConnection[];
}

/**
 * Parse Mermaid flowchart syntax
 */
export function parseMermaidFlowchart(markdown: string): MermaidDiagram | null {
  // Extract mermaid code block
  const mermaidBlockRegex = /```mermaid\s*([\s\S]*?)```/i;
  const match = markdown.match(mermaidBlockRegex);
  
  if (!match) {
    // Try without code block (raw mermaid)
    return parseMermaidContent(markdown);
  }
  
  return parseMermaidContent(match[1]);
}

function parseMermaidContent(content: string): MermaidDiagram | null {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%'));
  
  if (lines.length === 0) return null;
  
  // Parse direction from first line
  const firstLine = lines[0];
  let direction: 'TD' | 'LR' | 'BT' | 'RL' = 'TD';
  
  if (/graph\s+(TD|LR|BT|RL)/i.test(firstLine)) {
    const dirMatch = firstLine.match(/graph\s+(TD|LR|BT|RL)/i);
    if (dirMatch) {
      direction = dirMatch[1].toUpperCase() as 'TD' | 'LR' | 'BT' | 'RL';
    }
  } else if (/flowchart\s+(TD|LR|BT|RL)/i.test(firstLine)) {
    const dirMatch = firstLine.match(/flowchart\s+(TD|LR|BT|RL)/i);
    if (dirMatch) {
      direction = dirMatch[1].toUpperCase() as 'TD' | 'LR' | 'BT' | 'RL';
    }
  }
  
  const nodes = new Map<string, MermaidNode>();
  const connections: MermaidConnection[] = [];
  
  // Parse lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip comments
    if (line.startsWith('%%')) continue;
    
    // Parse connections (A --> B, A ---|label|--> B, A -.-> B)
    const connectionRegex = /(\w+)\s*(-->|---|-\.-|==>|==)(\|[^|]+\|)?\s*(-->|---|-\.-|==>|==)?\s*(\w+)/;
    const connMatch = line.match(connectionRegex);
    
    if (connMatch) {
      const from = connMatch[1];
      const arrow1 = connMatch[2];
      const label = connMatch[3] ? connMatch[3].replace(/\|/g, '').trim() : undefined;
      const to = connMatch[5];
      
      // Determine line type
      let lineType: 'solid' | 'dashed' | 'thick' = 'solid';
      if (arrow1.includes('.')) lineType = 'dashed';
      if (arrow1.includes('=')) lineType = 'thick';
      
      connections.push({ from, to, label, lineType });
      
      // Ensure nodes exist (in case they weren't defined explicitly)
      if (!nodes.has(from)) {
        nodes.set(from, { id: from, text: from, shapeType: 'rect' });
      }
      if (!nodes.has(to)) {
        nodes.set(to, { id: to, text: to, shapeType: 'rect' });
      }
      continue;
    }
    
    // Parse node definitions (A[Text], B(Text), C{Text}, etc.)
    const nodeRegex = /(\w+)([\[\(\{<][\[\(]?)(.*?)([\]\)\}>][\]\)]?)/;
    const nodeMatch = line.match(nodeRegex);
    
    if (nodeMatch) {
      const id = nodeMatch[1];
      const openBracket = nodeMatch[2];
      const text = nodeMatch[3];
      const closeBracket = nodeMatch[4];
      
      const shapeType = detectShapeType(openBracket, closeBracket);
      nodes.set(id, { id, text, shapeType });
    }
  }
  
  return { direction, nodes, connections };
}

/**
 * Detect shape type from Mermaid bracket notation
 */
function detectShapeType(open: string, close: string): ShapeType {
  // [text] - rectangle
  if (open === '[' && close === ']') return 'rect';
  
  // (text) - rounded rectangle / stadium
  if (open === '(' && close === ')') return 'stadium';
  
  // ([text]) - stadium (explicit)
  if (open === '([' && close === '])') return 'stadium';
  
  // [[text]] - subroutine (rounded rect)
  if (open === '[[' && close === ']]') return 'roundedRect';
  
  // [(text)] - cylindrical database
  if (open === '[(' && close === ')]') return 'cylinder';
  
  // {text} - decision diamond
  if (open === '{' && close === '}') return 'rhombus';
  
  // {{text}} - hexagon
  if (open === '{{' && close === '}}') return 'hexagon';
  
  // ((text)) - circle
  if (open === '((' && close === '))') return 'circle';
  
  // >text] - asymmetric (use trapezoid)
  if (open.includes('>') && close === ']') return 'trapezoid';
  
  // Default to rectangle
  return 'rect';
}

/**
 * Auto-layout nodes using hierarchical algorithm
 */
export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function layoutDiagram(diagram: MermaidDiagram): Map<string, LayoutNode> {
  const layout = new Map<string, LayoutNode>();
  
  // Default spacing
  const horizontalSpacing = 200;
  const verticalSpacing = 150;
  const defaultWidth = 120;
  const defaultHeight = 80;
  
  // Build adjacency list to find hierarchy
  const adjacency = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  
  for (const node of diagram.nodes.keys()) {
    adjacency.set(node, new Set());
    inDegree.set(node, 0);
  }
  
  for (const conn of diagram.connections) {
    adjacency.get(conn.from)?.add(conn.to);
    inDegree.set(conn.to, (inDegree.get(conn.to) || 0) + 1);
  }
  
  // Topological sort to find layers
  const layers: string[][] = [];
  const queue: string[] = [];
  const visited = new Set<string>();
  
  // Find root nodes (in-degree 0)
  for (const [node, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(node);
    }
  }
  
  // If no roots found, use all nodes (might be cyclic)
  if (queue.length === 0) {
    queue.push(...diagram.nodes.keys());
  }
  
  // BFS to create layers
  while (queue.length > 0) {
    const layerSize = queue.length;
    const currentLayer: string[] = [];
    
    for (let i = 0; i < layerSize; i++) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      
      visited.add(node);
      currentLayer.push(node);
      
      // Add children to queue
      const children = adjacency.get(node);
      if (children) {
        for (const child of children) {
          if (!visited.has(child)) {
            queue.push(child);
          }
        }
      }
    }
    
    if (currentLayer.length > 0) {
      layers.push(currentLayer);
    }
  }
  
  // Add any unvisited nodes (isolated or cyclic)
  for (const node of diagram.nodes.keys()) {
    if (!visited.has(node)) {
      layers.push([node]);
    }
  }
  
  // Position nodes based on direction
  const isHorizontal = diagram.direction === 'LR' || diagram.direction === 'RL';
  const startX = 100;
  const startY = 100;
  
  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    const layerWidth = layer.length * (defaultWidth + horizontalSpacing) - horizontalSpacing;
    
    for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
      const nodeId = layer[nodeIdx];
      const node = diagram.nodes.get(nodeId)!;
      
      // Adjust size based on shape type
      let w = defaultWidth;
      let h = defaultHeight;
      
      if (node.shapeType === 'stadium') {
        w = 150; h = 60;
      } else if (node.shapeType === 'rhombus') {
        w = 120; h = 120;
      } else if (node.shapeType === 'circle') {
        w = 100; h = 100;
      }
      
      let x: number, y: number;
      
      if (isHorizontal) {
        // Horizontal layout (LR or RL)
        x = startX + layerIdx * (defaultWidth + horizontalSpacing);
        y = startY + nodeIdx * (defaultHeight + verticalSpacing);
        
        if (diagram.direction === 'RL') {
          x = startX + (layers.length - layerIdx - 1) * (defaultWidth + horizontalSpacing);
        }
      } else {
        // Vertical layout (TD or BT)
        x = startX + nodeIdx * (defaultWidth + horizontalSpacing);
        y = startY + layerIdx * (defaultHeight + verticalSpacing);
        
        if (diagram.direction === 'BT') {
          y = startY + (layers.length - layerIdx - 1) * (defaultHeight + verticalSpacing);
        }
      }
      
      // Center layer
      if (!isHorizontal) {
        x = x - layerWidth / 2 + window.innerWidth / 2;
      }
      
      layout.set(nodeId, { id: nodeId, x, y, w, h });
    }
  }
  
  return layout;
}

