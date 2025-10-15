import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() { return Object.keys(store).length; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock timers
vi.useFakeTimers();

describe('Auto-Save Service', () => {
  let autoSaveService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Import the service fresh for each test
    const module = await import('../services/autoSaveService');
    autoSaveService = module.autoSaveService;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Settings Management', () => {
    it('should load default settings', () => {
      const settings = autoSaveService.getSettings();
      
      expect(settings).toEqual({
        enabled: true,
        intervalMs: 30000,
        maxBackups: 5
      });
    });

    it('should update settings', () => {
      autoSaveService.updateSettings({ intervalMs: 15000 });
      
      const settings = autoSaveService.getSettings();
      expect(settings.intervalMs).toBe(15000);
      expect(settings.enabled).toBe(true); // Should preserve other settings
    });

    it('should persist settings to localStorage', () => {
      autoSaveService.updateSettings({ enabled: false, intervalMs: 60000 });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'autoSaveSettings', 
        JSON.stringify({ enabled: false, intervalMs: 60000, maxBackups: 5 })
      );
    });
  });

  describe('Backup Management', () => {
    it('should create backup in localStorage', async () => {
      const testShapes = {
        'shape1': {
          id: 'shape1',
          type: 'rect' as const,
          x: 100,
          y: 100,
          w: 120,
          h: 80,
          updated_at: Date.now(),
          updated_by: 'test-user',
          color: '#ff0000'
        }
      };

      await autoSaveService.createBackup('canvas123', testShapes, 'Test Canvas', 'room123');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'canvas_backup_canvas123',
        expect.stringContaining('canvas123')
      );
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'canvas_latest_backup',
        expect.stringContaining('canvas123')
      );
    });

    it('should retrieve available backups', async () => {
      // Create test backup data
      const backupData = {
        canvasId: 'canvas123',
        shapes: {},
        lastModified: Date.now(),
        canvasTitle: 'Test Canvas',
        roomId: 'room123'
      };
      
      localStorageMock.setItem('canvas_backup_canvas123', JSON.stringify(backupData));
      
      const backups = autoSaveService.getAvailableBackups();
      
      expect(backups).toHaveLength(1);
      expect(backups[0]).toMatchObject({
        canvasId: 'canvas123',
        canvasTitle: 'Test Canvas'
      });
    });

    it('should clean up old backups beyond maxBackups limit', async () => {
      // Create 6 backups (max is 5)
      for (let i = 1; i <= 6; i++) {
        const backupData = {
          canvasId: `canvas${i}`,
          shapes: {},
          lastModified: Date.now() - (6 - i) * 1000, // Older backups have earlier timestamps
          canvasTitle: `Canvas ${i}`,
          roomId: `room${i}`
        };
        
        localStorageMock.setItem(`canvas_backup_canvas${i}`, JSON.stringify(backupData));
      }
      
      // Trigger cleanup by creating a new backup
      await autoSaveService.createBackup('canvas7', {}, 'Canvas 7', 'room7');
      
      // Should have removed old backups
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe('Recovery Detection', () => {
    it('should detect recent backup for recovery', () => {
      const recentBackup = {
        canvasId: 'canvas123',
        timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
        title: 'Test Canvas'
      };
      
      const backupState = {
        canvasId: 'canvas123',
        shapes: { 'shape1': { id: 'shape1', type: 'rect' } },
        lastModified: Date.now() - 30 * 60 * 1000,
        canvasTitle: 'Test Canvas',
        roomId: 'room123'
      };
      
      localStorageMock.setItem('canvas_latest_backup', JSON.stringify(recentBackup));
      localStorageMock.setItem('canvas_backup_canvas123', JSON.stringify(backupState));
      
      const recoveryData = autoSaveService.checkForRecovery();
      
      expect(recoveryData).toBeTruthy();
      expect(recoveryData?.canvasId).toBe('canvas123');
    });

    it('should not detect old backup for recovery', () => {
      const oldBackup = {
        canvasId: 'canvas123',
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        title: 'Test Canvas'
      };
      
      localStorageMock.setItem('canvas_latest_backup', JSON.stringify(oldBackup));
      
      const recoveryData = autoSaveService.checkForRecovery();
      
      expect(recoveryData).toBeNull();
    });
  });

  describe('Auto-Save Timer', () => {
    it('should start and stop auto-save timer', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      // Create fresh instance after spies are set up
      const { AutoSaveService } = await import('../services/autoSaveService');
      const freshService = new AutoSaveService();
      
      // Stop any existing timer from constructor
      freshService.stopAutoSaveTimer();
      setIntervalSpy.mockClear();
      clearIntervalSpy.mockClear();
      
      freshService.startAutoSaveTimer();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
      
      freshService.stopAutoSaveTimer();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should update timer interval when settings change', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      // Create fresh instance after spies are set up  
      const { AutoSaveService } = await import('../services/autoSaveService');
      const freshService = new AutoSaveService();
      
      // Clear any calls from constructor
      setIntervalSpy.mockClear();
      
      freshService.updateSettings({ intervalMs: 15000 });
      
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15000);
    });
  });

  describe('Status Callbacks', () => {
    it('should call status callback during save operations', () => {
      const statusCallback = vi.fn();
      
      autoSaveService.init(statusCallback);
      
      // Trigger status change (this would normally happen during save)
      autoSaveService.notifyStatus?.('saving', 'Auto-saving...');
      
      expect(statusCallback).toHaveBeenCalledWith('saving', 'Auto-saving...');
    });
  });
});

describe('Zustand Store Auto-Save Integration', () => {
  let useCanvas: any;

  beforeEach(async () => {
    // Mock the auto-save service import
    vi.doMock('../services/autoSaveService', () => ({
      autoSaveService: {
        updateSettings: vi.fn(),
        checkForRecovery: vi.fn(() => null),
        restoreFromBackup: vi.fn(),
        clearRecoveryData: vi.fn(),
        init: vi.fn()
      }
    }));

    // Import store after mocking
    const storeModule = await import('../state/store');
    useCanvas = storeModule.useCanvas;
    
    // Reset store state to defaults
    useCanvas.setState({
      shapes: {},
      selectedIds: [],
      currentCanvas: null,
      hasUnsavedChanges: false,
      saveStatus: 'idle',
      saveMessage: null,
      isCanvasLoading: false,
      canvasError: null
    });
  });

  it('should mark canvas as unsaved when shapes are modified', () => {
    const state = useCanvas.getState();
    
    // Set up a current canvas
    state.setCurrentCanvas({
      id: 'canvas123',
      title: 'Test Canvas',
      user_id: 'user123',
      room_id: 'room123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_public: false,
      data: {}
    });
    
    // Initially no unsaved changes
    expect(state.hasUnsavedChanges).toBe(false);
    
    // Add a shape - should mark as unsaved
    const testShape = {
      id: 'shape123',
      type: 'rect' as const,
      x: 100,
      y: 100,
      w: 120,
      h: 80,
      updated_at: Date.now(),
      updated_by: 'test-user',
      color: '#ff0000'
    };
    
    state.upsert(testShape);
    
    expect(state.hasUnsavedChanges).toBe(true);
  });

  it('should reset unsaved changes after save', async () => {
    const state = useCanvas.getState();
    
    // Set up canvas with unsaved changes
    state.setCurrentCanvas({
      id: 'canvas123',
      title: 'Test Canvas',
      user_id: 'user123', 
      room_id: 'room123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_public: false,
      data: {}
    });
    
    state.setUnsavedChanges(true);
    expect(state.hasUnsavedChanges).toBe(true);
    
    // Simulate save completion
    state.setUnsavedChanges(false);
    expect(state.hasUnsavedChanges).toBe(false);
  });

  it('should track save status correctly', () => {
    const state = useCanvas.getState();
    
    expect(state.saveStatus).toBe('idle');
    
    state.setSaveStatus('saving', 'Auto-saving...');
    expect(state.saveStatus).toBe('saving');
    expect(state.saveMessage).toBe('Auto-saving...');
    
    state.setSaveStatus('saved', 'Saved successfully');
    expect(state.saveStatus).toBe('saved');
    expect(state.saveMessage).toBe('Saved successfully');
  });
});
