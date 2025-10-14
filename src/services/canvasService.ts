import { supabase } from '../lib/supabaseClient';
import type { ShapeBase } from '../types';

export interface Canvas {
  id: string;
  title: string;
  user_id: string;
  room_id: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  thumbnail_url?: string;
  data: Record<string, any>;
}

export interface CreateCanvasData {
  title: string;
  shapes?: ShapeBase[];
}

export interface SaveCanvasData {
  title?: string;
  data?: Record<string, any>;
}

/**
 * Canvas service for managing multiple canvas projects
 */
class CanvasService {
  /**
   * Get all canvases for the current user
   */
  async getUserCanvases(): Promise<Canvas[]> {
    const { data, error } = await supabase
      .from('canvases')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading canvases:', error);
      throw new Error('Failed to load canvases');
    }

    return data || [];
  }

  /**
   * Get a specific canvas by ID
   */
  async getCanvas(canvasId: string): Promise<Canvas | null> {
    const { data, error } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Canvas not found
      }
      console.error('Error loading canvas:', error);
      throw new Error('Failed to load canvas');
    }

    return data;
  }

  /**
   * Create a new canvas
   */
  async createCanvas(canvasData: CreateCanvasData): Promise<Canvas> {
    // Use the database function for creating canvases
    const { data, error } = await supabase.rpc('create_new_canvas', {
      canvas_title: canvasData.title
    });

    if (error) {
      console.error('Error creating canvas:', error);
      throw new Error('Failed to create canvas');
    }

    const canvasId = data;

    // If shapes are provided, save them to the canvas
    if (canvasData.shapes && canvasData.shapes.length > 0) {
      await this.saveShapesToCanvas(canvasId, canvasData.shapes);
    }

    // Return the created canvas
    const canvas = await this.getCanvas(canvasId);
    if (!canvas) {
      throw new Error('Failed to retrieve created canvas');
    }

    return canvas;
  }

  /**
   * Save canvas metadata (title, settings, etc.)
   */
  async saveCanvas(canvasId: string, saveData: SaveCanvasData): Promise<void> {
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (saveData.title !== undefined) {
      updates.title = saveData.title;
    }

    if (saveData.data !== undefined) {
      updates.data = saveData.data;
    }

    const { error } = await supabase
      .from('canvases')
      .update(updates)
      .eq('id', canvasId);

    if (error) {
      console.error('Error saving canvas:', error);
      throw new Error('Failed to save canvas');
    }
  }

  /**
   * Duplicate a canvas
   */
  async duplicateCanvas(sourceCanvasId: string, newTitle?: string): Promise<Canvas> {
    const { data, error } = await supabase.rpc('duplicate_canvas', {
      source_canvas_id: sourceCanvasId,
      new_title: newTitle
    });

    if (error) {
      console.error('Error duplicating canvas:', error);
      throw new Error('Failed to duplicate canvas');
    }

    const canvasId = data;

    // Return the duplicated canvas
    const canvas = await this.getCanvas(canvasId);
    if (!canvas) {
      throw new Error('Failed to retrieve duplicated canvas');
    }

    return canvas;
  }

  /**
   * Delete a canvas and all its shapes
   */
  async deleteCanvas(canvasId: string): Promise<void> {
    const { error } = await supabase
      .from('canvases')
      .delete()
      .eq('id', canvasId);

    if (error) {
      console.error('Error deleting canvas:', error);
      throw new Error('Failed to delete canvas');
    }
  }

  /**
   * Get all shapes for a specific canvas
   */
  async getCanvasShapes(canvasId: string): Promise<ShapeBase[]> {
    const { data, error } = await supabase
      .from('shapes')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('updated_at', { ascending: true });

    if (error) {
      console.error('Error loading canvas shapes:', error);
      throw new Error('Failed to load canvas shapes');
    }

    // Convert database format to app format
    return (data || []).map((shape: any) => ({
      id: shape.id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      w: shape.w,
      h: shape.h,
      rotation: shape.rotation || 0,
      color: shape.color,
      text: shape.text,
      fontSize: shape.fontSize,
      fontFamily: shape.fontFamily,
      stroke: shape.stroke,
      strokeWidth: shape.strokeWidth,
      updated_at: shape.updated_at,
      updated_by: shape.updated_by,
    }));
  }

  /**
   * Save shapes to a specific canvas
   */
  async saveShapesToCanvas(canvasId: string, shapes: ShapeBase[]): Promise<void> {
    // Get the canvas to find the room_id
    const canvas = await this.getCanvas(canvasId);
    if (!canvas) {
      throw new Error('Canvas not found');
    }

    // Prepare shapes for database insertion
    const shapesToInsert = shapes.map(shape => ({
      id: shape.id,
      canvas_id: canvasId,
      room_id: canvas.room_id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      w: shape.w,
      h: shape.h,
      rotation: shape.rotation || 0,
      color: shape.color,
      text: shape.text || '',
      fontSize: shape.fontSize,
      fontFamily: shape.fontFamily,
      stroke: shape.stroke,
      strokeWidth: shape.strokeWidth,
      updated_at: shape.updated_at,
      updated_by: shape.updated_by,
    }));

    const { error } = await supabase
      .from('shapes')
      .upsert(shapesToInsert, { onConflict: 'id' });

    if (error) {
      console.error('Error saving shapes to canvas:', error);
      throw new Error('Failed to save shapes to canvas');
    }
  }

  /**
   * Clear all shapes from a canvas
   */
  async clearCanvas(canvasId: string): Promise<void> {
    const { error } = await supabase
      .from('shapes')
      .delete()
      .eq('canvas_id', canvasId);

    if (error) {
      console.error('Error clearing canvas:', error);
      throw new Error('Failed to clear canvas');
    }
  }

  /**
   * Generate a thumbnail for a canvas (placeholder implementation)
   */
  async generateThumbnail(canvasId: string, dataUrl: string): Promise<string> {
    // TODO: Implement thumbnail generation/storage
    // For now, just return the dataUrl
    
    // Update canvas with thumbnail URL
    await this.saveCanvas(canvasId, {
      data: { thumbnail: dataUrl }
    });

    return dataUrl;
  }
}

// Export singleton instance
export const canvasService = new CanvasService();
export default canvasService;
