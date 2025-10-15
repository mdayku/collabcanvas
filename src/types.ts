export type ShapeType = "rect" | "circle" | "text" | "image" | "triangle" | "star" | "heart" | "pentagon" | "hexagon" | "octagon" | "trapezoid" | "rhombus" | "parallelogram" | "oval" | "line" | "arrow";

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
  updated_at: number;
  updated_by: string;
};

export type Cursor = { 
  id: string; 
  name: string; 
  x: number; 
  y: number; 
  color: string; 
  last: number 
};

// Helper types for shape creation
export type CreateShapeData = Omit<ShapeBase, 'id' | 'updated_at' | 'updated_by'>;
export type UpdateShapeData = Partial<Omit<ShapeBase, 'id' | 'updated_at' | 'updated_by'>>;
