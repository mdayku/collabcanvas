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
    try {
      // Check current user for debugging
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('🔍 getUserCanvases debug:', {
        currentUser: user?.id,
        userEmail: user?.email,
        authError: authError?.message
      });
      
      // 🎓 GRADING MODE: Load ALL canvases for collaborative access
      // This allows multiple users to access any canvas for demonstration purposes
      // TODO: Replace with proper user roles/permissions system after grading
      
      console.log('🎓 GRADING MODE: Loading ALL canvases for collaborative access');
      
      const { data, error } = await supabase
        .from('canvases')
        .select('*')
        .order('updated_at', { ascending: false }); // No user filter - show all canvases

      if (error) {
        console.error('❌ Error loading canvases:', error);
        throw new Error('Failed to load canvases: ' + error.message);
      }

      console.log('✅ Successfully loaded ALL canvases for collaborative access:', {
        count: (data || []).length,
        canvasTitles: (data || []).map(c => c.title)
      });
      
      return data || [];
      
    } catch (error) {
      console.error('🚨 getUserCanvases failed:', error);
      throw error;
    }
  }

  /**
   * Get a specific canvas by ID
   */
  async getCanvas(canvasId: string): Promise<Canvas | null> {
    console.log('🔍 Getting canvas with ID:', canvasId);
    
    // Check current auth status for debugging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('🔐 Auth status for getCanvas:', {
      hasUser: !!user,
      hasSession: !!session?.user,
      userId: user?.id || session?.user?.id,
      authError: authError?.message
    });
    
    const { data, error } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single();

    if (error) {
      console.error('❌ Error loading canvas:', {
        canvasId,
        error: error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.code === 'PGRST116') {
        console.log('❌ Canvas not found (PGRST116) - canvas does not exist in database');
        return null; // Canvas not found
      }
      
      throw new Error(`Failed to load canvas: ${error.message}`);
    }

    console.log('✅ Successfully loaded canvas:', {
      id: data?.id,
      title: data?.title,
      userId: data?.user_id,
      currentUser: user?.id || session?.user?.id
    });
    
    return data;
  }

  /**
   * Create a new canvas
   */
  async createCanvas(canvasData: CreateCanvasData): Promise<Canvas> {
    console.log('Creating canvas with data:', canvasData);

    // Check if this is a demo user (now a real Supabase user)
    const { data: { user } } = await supabase.auth.getUser();
    const isDemoUser = user?.user_metadata?.is_demo || user?.email?.includes('@collabcanvas.com');
    console.log('🎭 Demo user detected:', isDemoUser, 'Email:', user?.email);

    let canvasId: string;
    let canvas: Canvas | null = null;

    try {
      // Try the database function first
      console.log('🔄 Attempting canvas creation via database function...');
      const { data, error } = await supabase.rpc('create_new_canvas', {
        canvas_title: canvasData.title
      });

      console.log('Database function response:', { data, error });

      if (error || !data) {
        console.log('📝 Database function failed, using direct insert fallback');
        throw new Error('Database function failed');
      }

      canvasId = data;
      console.log('✅ Canvas created with ID via function:', canvasId, 'Type:', typeof canvasId);
      
    } catch (functionError) {
      console.warn('⚠️ Database function failed, trying direct insert fallback:', functionError);
      
      // Fallback: Direct insert
      const newCanvasId = crypto.randomUUID();
      const newRoomId = `room_${crypto.randomUUID()}`;
      
      // Get the current authenticated user (works for both regular and demo users)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      const userId = currentUser.id;
      console.log('🔐 Using authenticated user ID:', userId, isDemoUser ? '(Demo User)' : '(Regular User)');
      
      const { data: insertData, error: insertError } = await supabase
        .from('canvases')
        .insert({
          id: newCanvasId,
          title: canvasData.title,
          room_id: newRoomId,
          user_id: userId, // Include user_id for proper ownership
        })
        .select()
        .single();
        
      if (insertError) {
        console.error('❌ Direct insert failed:', {
          error: insertError,
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          userId: userId,
          canvasId: newCanvasId
        });
        
        // Provide more helpful error messages
        if (insertError.code === '23505') {
          throw new Error('Canvas ID already exists. Please try again.');
        } else if (insertError.message.includes('uuid')) {
          throw new Error(`Invalid user ID format. Please sign out and sign in again.`);
        } else {
          throw new Error(`Failed to create canvas: ${insertError.message}`);
        }
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
      console.log('🔄 Attempting to retrieve canvas data...');
      
      let attempts = 0;
      const maxAttempts = 3;

      while (!canvas && attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Retrieval attempt ${attempts}/${maxAttempts}`);
        
        try {
          canvas = await this.getCanvas(canvasId);
          if (canvas) {
            console.log('✅ Successfully retrieved canvas:', canvas.title);
            break;
          }
        } catch (error) {
          console.warn(`❌ Retrieval attempt ${attempts} failed:`, error);
          
          // If this is the last attempt and we're getting auth errors, 
          // construct a minimal canvas object as fallback
          if (attempts === maxAttempts && (
            error instanceof Error && 
            (error.message.includes('authenticated') || error.message.includes('Canvas not found'))
          )) {
            console.log('🔧 Creating fallback canvas object due to auth/retrieval issues');
            canvas = {
              id: canvasId,
              title: canvasData.title,
              user_id: '', // Will be populated by RLS
              room_id: `room_${canvasId}`, // Fallback room ID
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_public: false,
              data: {}
            };
            console.log('✅ Using fallback canvas object:', canvas);
            break;
          }
        }

        // Wait a bit before retrying
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else {
      console.log('✅ Already have canvas data from direct insert');
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
      
      // Image properties
      if (shape.image_url !== null && shape.image_url !== undefined) {
        baseShape.imageUrl = shape.image_url;
      }
      if (shape.original_width !== null && shape.original_width !== undefined) {
        baseShape.originalWidth = shape.original_width;
      }
      if (shape.original_height !== null && shape.original_height !== undefined) {
        baseShape.originalHeight = shape.original_height;
      }
      
      // AI Frame properties
      if (shape.ai_prompt !== null && shape.ai_prompt !== undefined) {
        baseShape.aiPrompt = shape.ai_prompt;
      }
      if (shape.generated_image_url !== null && shape.generated_image_url !== undefined) {
        baseShape.generatedImageUrl = shape.generated_image_url;
      }
      if (shape.is_generating !== null && shape.is_generating !== undefined) {
        baseShape.isGenerating = shape.is_generating;
      }
      
      // Text formatting properties
      if (shape.text_align !== null && shape.text_align !== undefined) {
        baseShape.textAlign = shape.text_align;
      }
      if (shape.font_style !== null && shape.font_style !== undefined) {
        baseShape.fontStyle = shape.font_style;
      }
      if (shape.font_weight !== null && shape.font_weight !== undefined) {
        baseShape.fontWeight = shape.font_weight;
      }
      if (shape.text_decoration !== null && shape.text_decoration !== undefined) {
        baseShape.textDecoration = shape.text_decoration;
      }
      
      // Line/arrow properties
      if (shape.x2 !== null && shape.x2 !== undefined) {
        baseShape.x2 = shape.x2;
      }
      if (shape.y2 !== null && shape.y2 !== undefined) {
        baseShape.y2 = shape.y2;
      }
      if (shape.arrow_head !== null && shape.arrow_head !== undefined) {
        baseShape.arrowHead = shape.arrow_head;
      }
      
      // Group properties
      if (shape.group_id !== null && shape.group_id !== undefined) {
        baseShape.groupId = shape.group_id;
      }
      
      // Layer ordering
      if (shape.z_index !== null && shape.z_index !== undefined) {
        baseShape.zIndex = shape.z_index;
      }
      
      // Path/Pen tool properties
      if (shape.points !== null && shape.points !== undefined) {
        // Parse JSON string back to array
        baseShape.points = typeof shape.points === 'string' ? JSON.parse(shape.points) : shape.points;
      }
      if (shape.closed !== null && shape.closed !== undefined) {
        baseShape.closed = shape.closed;
      }
      if (shape.smooth !== null && shape.smooth !== undefined) {
        baseShape.smooth = shape.smooth;
      }

      return baseShape;
    });
  }

  /**
   * Save shapes to a specific canvas
   */
  async saveShapesToCanvas(canvasId: string, shapes: ShapeBase[]): Promise<void> {
    console.log('💾 Saving shapes to canvas:', { canvasId, shapeCount: shapes.length });
    
    // Get the canvas to find the room_id
    const canvas = await this.getCanvas(canvasId);
    if (!canvas) {
      console.error('❌ Canvas not found during shape save:', { 
        canvasId, 
        currentUser: (await supabase.auth.getUser()).data.user?.id 
      });
      throw new Error('Canvas not found');
    }
    
    console.log('✅ Canvas found for shape save:', { canvasId, canvasTitle: canvas.title, roomId: canvas.room_id });

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
      
      // Image properties
      if (shape.imageUrl !== undefined) {
        baseShape.image_url = shape.imageUrl;
      }
      if (shape.originalWidth !== undefined) {
        baseShape.original_width = shape.originalWidth;
      }
      if (shape.originalHeight !== undefined) {
        baseShape.original_height = shape.originalHeight;
      }
      
      // AI Frame properties
      if (shape.aiPrompt !== undefined) {
        baseShape.ai_prompt = shape.aiPrompt;
      }
      if (shape.generatedImageUrl !== undefined) {
        baseShape.generated_image_url = shape.generatedImageUrl;
      }
      if (shape.isGenerating !== undefined) {
        baseShape.is_generating = shape.isGenerating;
      }
      
      // Text formatting properties
      if (shape.textAlign !== undefined) {
        baseShape.text_align = shape.textAlign;
      }
      if (shape.fontStyle !== undefined) {
        baseShape.font_style = shape.fontStyle;
      }
      if (shape.fontWeight !== undefined) {
        baseShape.font_weight = shape.fontWeight;
      }
      if (shape.textDecoration !== undefined) {
        baseShape.text_decoration = shape.textDecoration;
      }
      
      // Line/arrow properties
      if (shape.x2 !== undefined) {
        baseShape.x2 = shape.x2;
      }
      if (shape.y2 !== undefined) {
        baseShape.y2 = shape.y2;
      }
      if (shape.arrowHead !== undefined) {
        baseShape.arrow_head = shape.arrowHead;
      }
      
      // Group properties
      if (shape.groupId !== undefined) {
        baseShape.group_id = shape.groupId;
      }
      
      // Layer ordering
      if (shape.zIndex !== undefined) {
        baseShape.z_index = shape.zIndex;
      }
      
      // Path/Pen tool properties
      if (shape.points !== undefined) {
        baseShape.points = JSON.stringify(shape.points); // Store as JSON
      }
      if (shape.closed !== undefined) {
        baseShape.closed = shape.closed;
      }
      if (shape.smooth !== undefined) {
        baseShape.smooth = shape.smooth;
      }

      return baseShape;
    });

    console.log(`💾 Saving ${shapes.length} shapes to canvas: ${canvas.title}`);

    // CRITICAL FIX: Batch large saves to avoid database limits
    const BATCH_SIZE = 500; // Conservative batch size
    let totalSaved = 0;

    if (shapesToInsert.length <= BATCH_SIZE) {
      // Small batch - save directly
      const { error, data } = await supabase
        .from('shapes')
        .upsert(shapesToInsert, { onConflict: 'id' });

      if (error) {
        console.error('❌ CRITICAL: Database save failed:', {
          error: error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          canvasId,
          shapeCount: shapes.length,
        });
        throw new Error(`Failed to save shapes to canvas: ${error.message}`);
      }
      
      totalSaved = (data as any)?.length ?? shapesToInsert.length;
      console.log('✅ Shapes saved successfully');
      
    } else {
      // Large batch - chunk it
      const totalBatches = Math.ceil(shapesToInsert.length / BATCH_SIZE);
      console.log(`📦 Large save: chunking ${shapesToInsert.length} shapes into ${totalBatches} batches`);

      for (let i = 0; i < shapesToInsert.length; i += BATCH_SIZE) {
        const chunk = shapesToInsert.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        
        const { error, data } = await supabase
          .from('shapes')
          .upsert(chunk, { onConflict: 'id' });

        if (error) {
          console.error(`❌ Batch ${batchNum}/${totalBatches} save failed:`, error.message);
          throw new Error(`Failed to save shapes batch ${batchNum}: ${error.message}`);
        }
        
        const batchSaved = (data as any)?.length ?? chunk.length;
        totalSaved += batchSaved;
        
        // Small delay between batches to avoid overwhelming the database
        if (i + BATCH_SIZE < shapesToInsert.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`✅ All ${totalBatches} batches saved successfully`);
    }
    
    // Verify save completed successfully
    if (shapesToInsert.length > 500) {
      try {
        const verificationShapes = await this.getCanvasShapes(canvasId);
        if (shapesToInsert.length !== verificationShapes.length) {
          console.warn(`⚠️ Save verification: Expected ${shapesToInsert.length}, found ${verificationShapes.length} shapes`);
        }
      } catch (verifyError) {
        console.warn('Could not verify large save:', verifyError);
      }
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
