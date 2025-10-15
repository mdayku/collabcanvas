/**
 * Auto-Save Management Slice
 * Handles auto-save status, settings, and recovery
 */

import type { StateCreator } from 'zustand';
import type { AutoSaveSettings } from '../../services/autoSaveService';

export interface AutoSaveSlice {
  // Auto-save state
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveMessage: string | null;
  autoSaveSettings: AutoSaveSettings;
  hasRecoveryData: boolean;

  // Auto-save actions
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error', message?: string) => void;
  updateAutoSaveSettings: (settings: Partial<AutoSaveSettings>) => void;
  checkForRecovery: () => Promise<void>;
  restoreFromRecovery: (recoveryData: any) => Promise<void>;
  clearRecoveryData: () => void;
  triggerManualSave: () => Promise<void>;
}

export const createAutoSaveSlice: StateCreator<
  AutoSaveSlice,
  [],
  [],
  AutoSaveSlice
> = (set, get) => ({
  // Initial state
  saveStatus: 'idle',
  saveMessage: null,
  autoSaveSettings: {
    enabled: true,
    intervalMs: 30000, // 30 seconds
    maxBackups: 5
  },
  hasRecoveryData: false,

  // Auto-save actions
  setSaveStatus: (status, message) => set({
    saveStatus: status,
    saveMessage: message || null
  }),

  updateAutoSaveSettings: async (settings) => {
    set((state) => ({
      autoSaveSettings: { ...state.autoSaveSettings, ...settings }
    }));
    
    // Update the auto-save service
    const { autoSaveService } = await import('../../services/autoSaveService');
    autoSaveService.updateSettings(settings);
  },

  checkForRecovery: async () => {
    try {
      const { autoSaveService } = await import('../../services/autoSaveService');
      const recoveryData = autoSaveService.checkForRecovery();
      
      set({ hasRecoveryData: !!recoveryData });
      
      if (recoveryData) {
        // Show recovery prompt
        const shouldRecover = confirm(
          `We found unsaved changes from "${recoveryData.canvasTitle}". Would you like to recover them?`
        );
        
        if (shouldRecover) {
          await get().restoreFromRecovery(recoveryData);
        } else {
          autoSaveService.clearRecoveryData();
          set({ hasRecoveryData: false });
        }
      }
    } catch (error) {
      console.error('Failed to check for recovery:', error);
    }
  },

  restoreFromRecovery: async (recoveryData) => {
    try {
      const { autoSaveService } = await import('../../services/autoSaveService');
      await autoSaveService.restoreFromBackup(recoveryData);
      
      set({ 
        hasRecoveryData: false, 
        saveStatus: 'idle'
      });
      
      console.log('✅ Recovery completed successfully');
    } catch (error) {
      console.error('Failed to restore from recovery:', error);
      // This will need to update canvas error in the main store
    }
  },

  clearRecoveryData: async () => {
    try {
      const { autoSaveService } = await import('../../services/autoSaveService');
      autoSaveService.clearRecoveryData();
      
      set({ hasRecoveryData: false });
    } catch (error) {
      console.error('Failed to clear recovery data:', error);
    }
  },

  triggerManualSave: async () => {
    try {
      set({ saveStatus: 'saving', saveMessage: 'Saving...' });
      
      // This will need to call saveCurrentCanvas from the canvas slice
      // await get().saveCurrentCanvas();
      
      set({ 
        saveStatus: 'saved', 
        saveMessage: 'Saved successfully' 
      });
      
      // Clear the "saved" status after a few seconds
      setTimeout(() => {
        set((state) => {
          if (state.saveStatus === 'saved') {
            return {
              saveStatus: 'idle' as const, 
              saveMessage: null 
            };
          }
          return state;
        });
      }, 3000);
      
    } catch (error) {
      console.error('Manual save failed:', error);
      set({
        saveStatus: 'error',
        saveMessage: error instanceof Error ? error.message : 'Save failed'
      });
    }
  },
});
