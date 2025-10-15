/**
 * Auto-Save Service for CollabCanvas
 * Handles automatic saving, crash recovery, and backup management
 */

import type { ShapeBase } from '../types';
import type { Canvas } from './canvasService';

export interface AutoSaveState {
  canvasId: string;
  shapes: Record<string, ShapeBase>;
  lastModified: number;
  canvasTitle: string;
  roomId: string;
}

export interface AutoSaveSettings {
  enabled: boolean;
  intervalMs: number; // Auto-save interval in milliseconds
  maxBackups: number; // Maximum number of backup states to keep
}

class AutoSaveService {
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isAutoSaving: boolean = false;
  private lastAutoSaveTime: number = 0;
  
  // Default settings
  private settings: AutoSaveSettings = {
    enabled: true,
    intervalMs: 30000, // 30 seconds
    maxBackups: 5
  };

  // Status callbacks
  private onSaveStatusChange: ((status: 'saving' | 'saved' | 'error', message?: string) => void) | null = null;

  constructor() {
    this.loadSettings();
    this.startAutoSaveTimer();
    this.setupBeforeUnloadHandler();
  }

  /**
   * Initialize the auto-save service with store integration
   */
  init(statusCallback?: (status: 'saving' | 'saved' | 'error', message?: string) => void) {
    this.onSaveStatusChange = statusCallback || null;
    console.log('🔄 Auto-save service initialized');
  }

  /**
   * Start the auto-save timer
   */
  startAutoSaveTimer() {
    if (!this.settings.enabled) return;
    
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      this.checkAndAutoSave();
    }, this.settings.intervalMs);

    console.log(`⏰ Auto-save timer started (${this.settings.intervalMs}ms interval)`);
  }

  /**
   * Stop the auto-save timer
   */
  stopAutoSaveTimer() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('⏹️ Auto-save timer stopped');
    }
  }

  /**
   * Update auto-save settings
   */
  updateSettings(newSettings: Partial<AutoSaveSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    
    // Restart timer with new interval
    if (newSettings.intervalMs) {
      this.startAutoSaveTimer();
    }
    
    // Enable/disable auto-save
    if (newSettings.enabled !== undefined) {
      if (newSettings.enabled) {
        this.startAutoSaveTimer();
      } else {
        this.stopAutoSaveTimer();
      }
    }
  }

  /**
   * Get current auto-save settings
   */
  getSettings(): AutoSaveSettings {
    return { ...this.settings };
  }

  /**
   * Check if auto-save should run and execute it
   */
  private async checkAndAutoSave() {
    // Get current state from Zustand store
    const { useCanvas } = await import('../state/store');
    const state = useCanvas.getState();
    
    // Skip if no canvas or no unsaved changes
    if (!state.currentCanvas || !state.hasUnsavedChanges) {
      return;
    }

    // Skip if already auto-saving
    if (this.isAutoSaving) {
      return;
    }

    // Skip if user recently saved manually (avoid conflicts)
    if (Date.now() - this.lastAutoSaveTime < 5000) {
      return;
    }

    await this.performAutoSave(state.currentCanvas, state.shapes);
  }

  /**
   * Perform the actual auto-save operation
   */
  private async performAutoSave(canvas: Canvas, shapes: Record<string, ShapeBase>) {
    if (this.isAutoSaving) return;

    try {
      this.isAutoSaving = true;
      this.lastAutoSaveTime = Date.now();
      
      this.notifyStatus('saving', 'Auto-saving...');

      // Create backup in localStorage before attempting save
      await this.createBackup(canvas.id, shapes, canvas.title, canvas.room_id);

      // Import and use the store's save function
      const { useCanvas } = await import('../state/store');
      await useCanvas.getState().saveCurrentCanvas();
      
      this.notifyStatus('saved', 'Auto-saved');
      console.log('✅ Auto-save completed successfully');

    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      this.notifyStatus('error', 'Auto-save failed - your work is backed up locally');
    } finally {
      this.isAutoSaving = false;
    }
  }

  /**
   * Create a backup in localStorage
   */
  async createBackup(canvasId: string, shapes: Record<string, ShapeBase>, title: string, roomId: string) {
    try {
      const backupState: AutoSaveState = {
        canvasId,
        shapes,
        lastModified: Date.now(),
        canvasTitle: title,
        roomId
      };

      const backupKey = `canvas_backup_${canvasId}`;
      localStorage.setItem(backupKey, JSON.stringify(backupState));
      
      // Also keep a "latest backup" entry for recovery detection
      localStorage.setItem('canvas_latest_backup', JSON.stringify({
        canvasId,
        timestamp: Date.now(),
        title
      }));

      // Clean up old backups
      this.cleanupOldBackups();
      
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  }

  /**
   * Get available backups for recovery
   */
  getAvailableBackups(): AutoSaveState[] {
    const backups: AutoSaveState[] = [];
    
    try {
      // Get all localStorage keys that match backup pattern
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('canvas_backup_')) {
          const backupData = localStorage.getItem(key);
          if (backupData) {
            const backup = JSON.parse(backupData) as AutoSaveState;
            backups.push(backup);
          }
        }
      }
      
      // Sort by last modified (newest first)
      return backups.sort((a, b) => b.lastModified - a.lastModified);
      
    } catch (error) {
      console.error('Failed to get backups:', error);
      return [];
    }
  }

  /**
   * Check if there's a recovery available (user closed app with unsaved changes)
   */
  checkForRecovery(): AutoSaveState | null {
    try {
      const latestBackup = localStorage.getItem('canvas_latest_backup');
      if (!latestBackup) return null;

      const { canvasId, timestamp, title } = JSON.parse(latestBackup);
      
      // If the backup is recent (within 1 hour), offer recovery
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      if (timestamp > oneHourAgo) {
        const backupData = localStorage.getItem(`canvas_backup_${canvasId}`);
        if (backupData) {
          return JSON.parse(backupData) as AutoSaveState;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to check for recovery:', error);
      return null;
    }
  }

  /**
   * Restore from a backup
   */
  async restoreFromBackup(backup: AutoSaveState): Promise<void> {
    try {
      const { useCanvas } = await import('../state/store');
      const store = useCanvas.getState();
      
      console.log('🔄 Restoring backup with', Object.keys(backup.shapes).length, 'shapes for canvas:', backup.canvasTitle);
      
      // For local recovery, don't try to load from database - just restore shapes to current canvas
      // Create a mock canvas object if needed
      if (!store.currentCanvas) {
        store.setCurrentCanvas({
          id: backup.canvasId,
          title: backup.canvasTitle,
          user_id: store.me.id,
          room_id: backup.roomId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_public: false,
          data: {}
        });
      } else {
        // Update the current canvas title if different
        if (store.currentCanvas.title !== backup.canvasTitle) {
          store.setCurrentCanvas({
            ...store.currentCanvas,
            title: backup.canvasTitle
          });
        }
      }
      
      // Clear existing shapes and restore from backup
      store.clear();
      store.upsert(Object.values(backup.shapes));
      store.setUnsavedChanges(true); // Mark as unsaved so user can save
      
      console.log('✅ Successfully restored', Object.keys(backup.shapes).length, 'shapes from backup');
      
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * Clear a specific backup
   */
  clearBackup(canvasId: string) {
    try {
      localStorage.removeItem(`canvas_backup_${canvasId}`);
      
      // Clear latest backup if it matches
      const latestBackup = localStorage.getItem('canvas_latest_backup');
      if (latestBackup) {
        const latest = JSON.parse(latestBackup);
        if (latest.canvasId === canvasId) {
          localStorage.removeItem('canvas_latest_backup');
        }
      }
    } catch (error) {
      console.error('Failed to clear backup:', error);
    }
  }

  /**
   * Clear all recovery data (call when work is safely saved)
   */
  clearRecoveryData() {
    try {
      // Remove all canvas backups
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('canvas_backup_') || key === 'canvas_latest_backup')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('🧹 Recovery data cleared');
      
    } catch (error) {
      console.error('Failed to clear recovery data:', error);
    }
  }

  /**
   * Clean up old backups beyond maxBackups limit
   */
  private cleanupOldBackups() {
    try {
      const backups = this.getAvailableBackups();
      
      if (backups.length > this.settings.maxBackups) {
        const toRemove = backups.slice(this.settings.maxBackups);
        toRemove.forEach(backup => {
          localStorage.removeItem(`canvas_backup_${backup.canvasId}`);
        });
        
        console.log(`🧹 Cleaned up ${toRemove.length} old backups`);
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * Set up before unload handler to create final backup
   */
  private setupBeforeUnloadHandler() {
    window.addEventListener('beforeunload', async () => {
      try {
        const { useCanvas } = await import('../state/store');
        const state = useCanvas.getState();
        
        if (state.currentCanvas && state.hasUnsavedChanges) {
          await this.createBackup(
            state.currentCanvas.id, 
            state.shapes, 
            state.currentCanvas.title,
            state.currentCanvas.room_id
          );
        }
      } catch (error) {
        console.error('Failed to create backup on beforeunload:', error);
      }
    });
  }

  /**
   * Notify status change
   */
  private notifyStatus(status: 'saving' | 'saved' | 'error', message?: string) {
    if (this.onSaveStatusChange) {
      this.onSaveStatusChange(status, message);
    }
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings() {
    try {
      const saved = localStorage.getItem('autoSaveSettings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load auto-save settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings() {
    try {
      localStorage.setItem('autoSaveSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save auto-save settings:', error);
    }
  }

  /**
   * Trigger immediate save (for manual save button)
   */
  async triggerSave(): Promise<void> {
    const { useCanvas } = await import('../state/store');
    const state = useCanvas.getState();
    
    if (!state.currentCanvas || !state.hasUnsavedChanges) {
      return;
    }

    await this.performAutoSave(state.currentCanvas, state.shapes);
  }
}

// Export singleton instance
export const autoSaveService = new AutoSaveService();
export default autoSaveService;
