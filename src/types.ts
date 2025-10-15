export type ShapeType = "rect" | "circle" | "text" | "image" | "triangle" | "star" | "heart" | "pentagon" | "hexagon" | "octagon" | "trapezoid" | "rhombus" | "parallelogram" | "oval";

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
  text?: string; // for text shapes
  fontSize?: number; // for text shapes
  fontFamily?: string; // for text shapes
  imageUrl?: string; // for image shapes (data URL or external URL)
  originalWidth?: number; // for image shapes (original image dimensions)
  originalHeight?: number; // for image shapes (original image dimensions)
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
