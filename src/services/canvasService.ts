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
    console.log('Getting canvas with ID:', canvasId);
    
    const { data, error } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single();

    if (error) {
      console.error('Error loading canvas:', {
        canvasId,
        error: error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.code === 'PGRST116') {
        console.log('Canvas not found (PGRST116)');
        return null; // Canvas not found
      }
      
      throw new Error(`Failed to load canvas: ${error.message}`);
    }

    console.log('Successfully loaded canvas:', data?.title);
    return data;
  }

  /**
   * Create a new canvas
   */
  async createCanvas(canvasData: CreateCanvasData): Promise<Canvas> {
    console.log('Creating canvas with data:', canvasData);

    let canvasId: string;
    let canvas: Canvas | null = null;

    try {
      // Try the database function first
      const { data, error } = await supabase.rpc('create_new_canvas', {
        canvas_title: canvasData.title
      });

      console.log('Database function response:', { data, error });

      if (error || !data) {
        throw new Error('Database function failed');
      }

      canvasId = data;
      console.log('Canvas created with ID via function:', canvasId, 'Type:', typeof canvasId);
      
    } catch (functionError) {
      console.warn('Database function failed, trying direct insert:', functionError);
      
      // Fallback: Direct insert
      const newCanvasId = crypto.randomUUID();
      const newRoomId = `room_${crypto.randomUUID()}`;
      
      const { data: insertData, error: insertError } = await supabase
        .from('canvases')
        .insert({
          id: newCanvasId,
          title: canvasData.title,
          room_id: newRoomId,
        })
        .select()
        .single();
        
      if (insertError) {
        console.error('Direct insert also failed:', insertError);
        throw new Error(`Failed to create canvas: ${insertError.message}`);
      }
      
      canvasId = newCanvasId;
      canvas = insertData; // We already have the canvas data
      console.log('Canvas created with ID via direct insert:', canvasId);
    }

    // If shapes are provided, save them to the canvas
    if (canvasData.shapes && canvasData.shapes.length > 0) {
      console.log('Saving shapes to new canvas:', canvasData.shapes.length);
      await this.saveShapesToCanvas(canvasId, canvasData.shapes);
    }

    // If we don't already have the canvas data, try to retrieve it
    if (!canvas) {
      console.log('Attempting to retrieve canvas data...');
      
      let attempts = 0;
      const maxAttempts = 3;

      while (!canvas && attempts < maxAttempts) {
        attempts++;
        console.log(`Attempting to retrieve canvas (attempt ${attempts}/${maxAttempts})`);
        
        try {
          canvas = await this.getCanvas(canvasId);
          if (canvas) {
            console.log('Successfully retrieved canvas:', canvas.title);
            break;
          }
        } catch (error) {
          console.warn(`Retrieval attempt ${attempts} failed:`, error);
        }

        // Wait a bit before retrying
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else {
      console.log('Already have canvas data from direct insert');
    }

    if (!canvas) {
      // Last resort: Try to get the canvas info directly from the database function result
      console.warn('Could not retrieve canvas via normal API, trying alternative approach');
      
      // Query the database directly for this specific canvas
      try {
        const { data: directData, error: directError } = await supabase
          .from('canvases')
          .select('*')
          .eq('id', canvasId)
          .maybeSingle(); // Use maybeSingle to avoid throwing on not found
          
        console.log('Direct query result:', { data: directData, error: directError });
        
        if (directData) {
          canvas = directData;
        } else {
          // Still no luck, construct manually but with better room_id logic
          console.warn('Canvas not found in direct query either, constructing fallback object');
          
          canvas = {
            id: canvasId,
            title: canvasData.title,
            user_id: '', // Will be populated by the system
            room_id: `room_${canvasId.replace(/-/g, '').substring(0, 12)}`, // Stable room_id based on canvas ID
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_public: false,
            data: {}
          };
        }
      } catch (directError) {
        console.error('Direct query also failed:', directError);
        
        // Final fallback
        canvas = {
          id: canvasId,
          title: canvasData.title,
          user_id: '',
          room_id: `room_${canvasId.replace(/-/g, '').substring(0, 12)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_public: false,
          data: {}
        };
      }
      
      console.log('Final canvas object:', canvas);
    }

    // Ensure we always have a canvas object
    if (!canvas) {
      throw new Error('Failed to create or retrieve canvas after all attempts');
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

    // Convert database format to app format with safe column handling
    return (data || []).map((shape: any) => {
      const baseShape: ShapeBase = {
        id: shape.id,
        type: shape.type,
        x: shape.x,
        y: shape.y,
        w: shape.w,
        h: shape.h,
        rotation: shape.rotation || 0,
        color: shape.color,
        text: shape.text,
        updated_at: shape.updated_at,
        updated_by: shape.updated_by,
      };

      // Safely add new columns if they exist
      if (shape.fontSize !== null && shape.fontSize !== undefined) {
        baseShape.fontSize = shape.fontSize;
      }
      if (shape.fontFamily !== null && shape.fontFamily !== undefined) {
        baseShape.fontFamily = shape.fontFamily;
      }
      if (shape.stroke !== null && shape.stroke !== undefined) {
        baseShape.stroke = shape.stroke;
      }
      if (shape.strokeWidth !== null && shape.strokeWidth !== undefined) {
        baseShape.strokeWidth = shape.strokeWidth;
      }

      return baseShape;
    });
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

    // Prepare shapes for database insertion with safe column handling
    const shapesToInsert = shapes.map(shape => {
      // Base shape data (always present)
      const baseShape: any = {
        id: shape.id,
        canvas_id: canvasId,
        room_id: canvas.room_id,
        type: shape.type,
        x: shape.x,
        y: shape.y,
        w: shape.w,
        h: shape.h,
        rotation: shape.rotation || 0,
        color: shape.color || null,
        text: shape.text || null,
        updated_at: shape.updated_at,
        updated_by: shape.updated_by,
      };

      // Add new columns only if they have values (migration-safe)
      if (shape.fontSize !== undefined) {
        baseShape.fontSize = shape.fontSize;
      }
      if (shape.fontFamily !== undefined) {
        baseShape.fontFamily = shape.fontFamily;
      }
      if (shape.stroke !== undefined) {
        baseShape.stroke = shape.stroke;
      }
      if (shape.strokeWidth !== undefined) {
        baseShape.strokeWidth = shape.strokeWidth;
      }

      return baseShape;
    });

    console.log('Saving shapes to canvas:', { canvasId, shapeCount: shapes.length, sampleShape: shapesToInsert[0] });

    const { error, data } = await supabase
      .from('shapes')
      .upsert(shapesToInsert, { onConflict: 'id' });

    if (error) {
      console.error('Detailed error saving shapes to canvas:', {
        error: error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        shapesToInsert: shapesToInsert.slice(0, 2) // Log first 2 shapes for debugging
      });
      throw new Error(`Failed to save shapes to canvas: ${error.message}`);
    }

    console.log('Successfully saved shapes to canvas:', { canvasId, savedCount: shapesToInsert.length });
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
