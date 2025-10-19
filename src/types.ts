export type ShapeType = "rect" | "circle" | "text" | "image" | "triangle" | "star" | "heart" | "pentagon" | "hexagon" | "octagon" | "trapezoid" | "rhombus" | "parallelogram" | "oval" | "line" | "arrow" | "frame" | "cylinder" | "document" | "path" | "roundedRect" | "stadium" | "note";

export type ShapeBase = {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  zIndex?: number; // for layer ordering
  text?: string; // for text shapes
  fontSize?: number; // for text shapes
  fontFamily?: string; // for text shapes
  textAlign?: 'left' | 'center' | 'right'; // for text shapes
  fontStyle?: 'normal' | 'italic'; // for text shapes
  fontWeight?: 'normal' | 'bold'; // for text shapes
  textDecoration?: 'none' | 'underline'; // for text shapes
  imageUrl?: string; // for image shapes (data URL or external URL)
  originalWidth?: number; // for image shapes (original image dimensions)
  originalHeight?: number; // for image shapes (original image dimensions)
  // Line and arrow properties
  x2?: number; // end point x for lines and arrows
  y2?: number; // end point y for lines and arrows
  arrowHead?: 'start' | 'end' | 'both' | 'none'; // arrow head configuration
  dashPattern?: number[]; // dash pattern for lines [dash, gap, dash, gap...]
  // Connection system (for attaching lines/arrows to shapes)
  startShapeId?: string; // shape ID that the line starts from
  endShapeId?: string; // shape ID that the line ends at
  startAnchor?: 'top' | 'right' | 'bottom' | 'left' | 'center'; // anchor point on start shape
  endAnchor?: 'top' | 'right' | 'bottom' | 'left' | 'center'; // anchor point on end shape
  pathType?: 'straight' | 'curved' | 'orthogonal'; // line path type
  controlPoints?: { x: number; y: number }[]; // bezier control points for curved lines
  curvature?: number; // curve tension (0-1) for simple curved lines
  groupId?: string; // group identifier for grouped shapes
  // AI Frame properties
  aiPrompt?: string; // the prompt used to generate AI image (for frame type)
  generatedImageUrl?: string; // URL of the generated AI image (for frame type)
  isGenerating?: boolean; // whether AI image generation is in progress
  // Path/Pen tool properties
  points?: { x: number; y: number }[]; // array of points for path shapes
  closed?: boolean; // whether the path is closed
  smooth?: boolean; // whether to use bezier smoothing
  updated_at: number;
  updated_by: string;
};

export type Cursor = { 
  id: string; 
  name: string; 
  x: number; 
  y: number; 
  color: string; 
  last: number;
  roomId: string; // Track which canvas/room this cursor belongs to
};

// Helper types for shape creation
export type CreateShapeData = Omit<ShapeBase, 'id' | 'updated_at' | 'updated_by'>;
export type UpdateShapeData = Partial<Omit<ShapeBase, 'id' | 'updated_at' | 'updated_by'>>;
