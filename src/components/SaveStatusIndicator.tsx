import React, { useEffect } from 'react';
import { useCanvas } from '../state/store';

/**
 * Save Status Indicator Component
 * Shows the current auto-save status and allows manual save
 */
export const SaveStatusIndicator: React.FC = () => {
  const {
    saveStatus,
    saveMessage,
    hasUnsavedChanges,
    currentCanvas,
    triggerManualSave,
    checkForRecovery
  } = useCanvas();

  // Check for recovery on component mount
  useEffect(() => {
    checkForRecovery();
  }, [checkForRecovery]);

  // Initialize auto-save service
  useEffect(() => {
    const initAutoSave = async () => {
      const { autoSaveService } = await import('../services/autoSaveService');
      const { setSaveStatus } = useCanvas.getState();
      
      // Initialize with status callback
      autoSaveService.init((status, message) => {
        setSaveStatus(status, message);
      });
    };
    
    initAutoSave();
  }, []);

  if (!currentCanvas) {
    return null; // Don't show when no canvas is loaded
  }

  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
        );
      case 'saved':
        return (
          <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        if (hasUnsavedChanges) {
          return (
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          );
        }
        return (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    if (saveMessage) {
      return saveMessage;
    }
    
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Save failed';
      default:
        if (hasUnsavedChanges) {
          return 'Unsaved changes';
        }
        return 'All changes saved';
    }
  };

  const getStatusColor = () => {
    switch (saveStatus) {
      case 'saving':
        return 'text-blue-600';
      case 'saved':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        if (hasUnsavedChanges) {
          return 'text-orange-600';
        }
        return 'text-gray-500';
    }
  };

  const handleManualSave = async () => {
    if (!hasUnsavedChanges || saveStatus === 'saving') return;
    
    try {
      await triggerManualSave();
    } catch (error) {
      console.error('Manual save failed:', error);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-md shadow-sm">
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>
      
      {/* Status Text */}
      <span className={`text-xs font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>
      
      {/* Manual Save Button */}
      {hasUnsavedChanges && saveStatus !== 'saving' && (
        <button
          onClick={handleManualSave}
          className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          title="Save now"
        >
          Save
        </button>
      )}
      
      {/* Auto-save indicator */}
      <div className="text-xs text-gray-400 ml-1" title="Auto-save enabled">
        ⏰
      </div>
    </div>
  );
};

/**
 * Auto-Save Settings Component
 * Allows users to configure auto-save behavior
 */
export const AutoSaveSettings: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
}> = ({ isOpen, onClose }) => {
  const { autoSaveSettings, updateAutoSaveSettings } = useCanvas();

  if (!isOpen) return null;

  const handleIntervalChange = (intervalMs: number) => {
    updateAutoSaveSettings({ intervalMs });
  };

  const handleEnabledChange = (enabled: boolean) => {
    updateAutoSaveSettings({ enabled });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Auto-Save Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Enable/Disable Auto-Save */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Enable Auto-Save
            </label>
            <input
              type="checkbox"
              checked={autoSaveSettings.enabled}
              onChange={(e) => handleEnabledChange(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          
          {/* Auto-Save Interval */}
          {autoSaveSettings.enabled && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Auto-Save Interval
              </label>
              <select
                value={autoSaveSettings.intervalMs}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={15000}>15 seconds</option>
                <option value={30000}>30 seconds (Default)</option>
                <option value={60000}>1 minute</option>
                <option value={120000}>2 minutes</option>
                <option value={300000}>5 minutes</option>
              </select>
            </div>
          )}
          
          {/* Max Backups */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Local Backup Limit
            </label>
            <select
              value={autoSaveSettings.maxBackups}
              onChange={(e) => updateAutoSaveSettings({ maxBackups: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={3}>3 backups</option>
              <option value={5}>5 backups (Default)</option>
              <option value={10}>10 backups</option>
            </select>
          </div>
          
          {/* Information */}
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
            <p className="mb-2">
              <strong>Auto-Save:</strong> Automatically saves your work to the cloud at regular intervals.
            </p>
            <p>
              <strong>Local Backup:</strong> Creates emergency backups in your browser for crash recovery.
            </p>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
