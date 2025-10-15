import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { Canvas } from '../services/canvasService';

interface CanvasSelectorProps {
  onCanvasSelect: (canvas: Canvas) => void;
  onCreateNew: (title: string) => void;
  onSkip?: () => void;
}

export function CanvasSelector({ onCanvasSelect, onCreateNew, onSkip }: CanvasSelectorProps) {
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCanvasTitle, setNewCanvasTitle] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const { colors, halloweenMode, actualTheme } = useTheme();

  useEffect(() => {
    loadCanvases();
  }, []);

  const loadCanvases = async () => {
    try {
      setLoading(true);
      const { canvasService } = await import('../services/canvasService');
      const userCanvases = await canvasService.getUserCanvases();
      setCanvases(userCanvases);
    } catch (err) {
      console.error('Failed to load canvases:', err);
      setError('Failed to load your canvases');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    if (newCanvasTitle.trim()) {
      onCreateNew(newCanvasTitle.trim());
    }
  };

  const handleDeleteCanvas = async (canvas: Canvas, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the canvas
    
    const confirmed = confirm(
      `Are you sure you want to delete "${canvas.title}"?\n\nThis action cannot be undone and will permanently remove the canvas and all its content.`
    );
    
    if (!confirmed) return;
    
    try {
      const { canvasService } = await import('../services/canvasService');
      await canvasService.deleteCanvas(canvas.id);
      
      // Remove from local state
      setCanvases(prev => prev.filter(c => c.id !== canvas.id));
      
      console.log('✅ Canvas deleted successfully:', canvas.title);
    } catch (error) {
      console.error('❌ Failed to delete canvas:', error);
      alert('Failed to delete canvas: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const toggleCanvasSelection = (canvasId: string) => {
    setSelectedForDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(canvasId)) {
        newSet.delete(canvasId);
      } else {
        newSet.add(canvasId);
      }
      return newSet;
    });
  };

  const selectAllTestCanvases = () => {
    const testCanvases = canvases.filter(canvas => 
      canvas.title.includes('My First Canvas') || 
      canvas.title.includes('New Canvas') ||
      canvas.title.includes('Workspace')
    );
    setSelectedForDelete(new Set(testCanvases.map(c => c.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedForDelete.size === 0) return;
    
    const canvasesToDelete = canvases.filter(c => selectedForDelete.has(c.id));
    const canvasTitles = canvasesToDelete.map(c => c.title).join('\n• ');
    
    const confirmed = confirm(
      `Are you sure you want to delete ${selectedForDelete.size} canvas(es)?\n\n• ${canvasTitles}\n\nThis action cannot be undone and will permanently remove all selected canvases and their content.`
    );
    
    if (!confirmed) return;
    
    try {
      const { canvasService } = await import('../services/canvasService');
      
      // Delete all selected canvases
      await Promise.all(
        Array.from(selectedForDelete).map(canvasId => 
          canvasService.deleteCanvas(canvasId)
        )
      );
      
      // Remove from local state
      setCanvases(prev => prev.filter(c => !selectedForDelete.has(c.id)));
      setSelectedForDelete(new Set());
      setShowBulkDelete(false);
      
      console.log(`✅ Successfully deleted ${selectedForDelete.size} canvases`);
    } catch (error) {
      console.error('❌ Failed to delete canvases:', error);
      alert('Failed to delete some canvases: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ 
        backgroundColor: halloweenMode 
          ? 'rgba(26, 15, 26, 0.9)' // Dark purple overlay for Halloween 
          : actualTheme === 'dark' 
          ? 'rgba(17, 24, 39, 0.8)' // Dark gray for dark mode
          : 'rgba(0, 0, 0, 0.4)' // Lighter overlay for light mode to reduce harsh contrast
      }}
    >
      <div 
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border shadow-2xl"
        style={{ 
          backgroundColor: actualTheme === 'light' ? '#ffffff' : colors.bgPrimary,
          borderColor: actualTheme === 'light' ? '#d1d5db' : colors.border,
          // Enhanced shadow for light mode
          boxShadow: actualTheme === 'light' 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div 
          className="px-6 py-4 border-b"
          style={{ 
            borderColor: actualTheme === 'light' ? '#e5e7eb' : colors.border,
            backgroundColor: actualTheme === 'light' ? '#f8fafc' : colors.bgSecondary 
          }}
        >
          <h2 
            className="text-2xl font-bold"
            style={{ color: actualTheme === 'light' ? '#0f172a' : colors.text }}
          >
            Welcome to CollabCanvas
          </h2>
          <p 
            className="text-sm mt-1"
            style={{ color: actualTheme === 'light' ? '#475569' : colors.textSecondary }}
          >
            Choose a canvas to open or create a new one
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div 
                className="text-lg"
                style={{ color: actualTheme === 'light' ? '#64748b' : colors.textSecondary }}
              >
                Loading your canvases...
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div 
                className="text-lg mb-4"
                style={{ color: actualTheme === 'light' ? '#dc2626' : colors.error || colors.text }}
              >
                {error}
              </div>
              <button
                onClick={loadCanvases}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: actualTheme === 'light' ? '#f3f4f6' : colors.buttonBg,
                  color: actualTheme === 'light' ? '#374151' : colors.text,
                  border: `1px solid ${actualTheme === 'light' ? '#d1d5db' : colors.border}`
                }}
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Existing Canvases */}
              {canvases.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 
                      className="text-lg font-semibold"
                      style={{ color: actualTheme === 'light' ? '#1e293b' : colors.text }}
                    >
                      🎓 All Canvases - Collaborative Access ({canvases.length})
                    </h3>
                    
                    {!showBulkDelete ? (
                      <button
                        onClick={() => setShowBulkDelete(true)}
                        className="text-sm px-3 py-1 rounded transition-colors"
                        style={{
                          backgroundColor: actualTheme === 'light' ? '#f3f4f6' : colors.buttonBg,
                          color: actualTheme === 'light' ? '#374151' : colors.text,
                          border: `1px solid ${actualTheme === 'light' ? '#d1d5db' : colors.border}`
                        }}
                        title="Clean up test canvases"
                      >
                        🧹 Cleanup
                      </button>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => setSelectedForDelete(new Set(canvases.map(c => c.id)))}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{
                            backgroundColor: actualTheme === 'light' ? '#f3e8ff' : '#581c87',
                            color: actualTheme === 'light' ? '#7c3aed' : '#ddd6fe'
                          }}
                          title="Select all canvases for deletion"
                        >
                          Select All ({canvases.length})
                        </button>
                        <button
                          onClick={() => setSelectedForDelete(new Set())}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{
                            backgroundColor: actualTheme === 'light' ? '#f3f4f6' : colors.buttonBg,
                            color: actualTheme === 'light' ? '#6b7280' : colors.textSecondary
                          }}
                          title="Deselect all canvases"
                        >
                          Deselect All
                        </button>
                        <button
                          onClick={selectAllTestCanvases}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{
                            backgroundColor: actualTheme === 'light' ? '#dbeafe' : '#1e40af',
                            color: actualTheme === 'light' ? '#1e40af' : '#dbeafe'
                          }}
                          title="Select canvases with test names (My First Canvas, New Canvas, Workspace)"
                        >
                          Select Test Canvases
                        </button>
                        <button
                          onClick={handleBulkDelete}
                          disabled={selectedForDelete.size === 0}
                          className="text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                          style={{
                            backgroundColor: selectedForDelete.size > 0 
                              ? (actualTheme === 'light' ? '#fee2e2' : '#7f1d1d')
                              : (actualTheme === 'light' ? '#f3f4f6' : colors.buttonBg),
                            color: selectedForDelete.size > 0 
                              ? (actualTheme === 'light' ? '#dc2626' : '#fca5a5')
                              : (actualTheme === 'light' ? '#6b7280' : colors.textSecondary)
                          }}
                        >
                          Delete {selectedForDelete.size > 0 ? `(${selectedForDelete.size})` : ''}
                        </button>
                        <button
                          onClick={() => {
                            setShowBulkDelete(false);
                            setSelectedForDelete(new Set());
                          }}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{
                            color: actualTheme === 'light' ? '#6b7280' : colors.textSecondary
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <p 
                    className="text-sm mb-4 p-2 rounded"
                    style={{ 
                      color: actualTheme === 'light' ? '#374151' : colors.textSecondary,
                      backgroundColor: actualTheme === 'light' ? '#fef3c7' : colors.bgSecondary,
                      border: `1px solid ${actualTheme === 'light' ? '#fbbf24' : colors.border}`
                    }}
                  >
                    💡 Grading Mode: All users can access any canvas for collaborative demonstration
                  </p>
                  <div className="grid gap-3 max-h-80 overflow-y-auto">
                    {canvases.map((canvas, index) => (
                      <div
                        key={canvas.id}
                        className="flex items-center justify-between p-4 rounded border text-left transition-colors hover:shadow-md relative"
                        style={{
                          backgroundColor: actualTheme === 'light' ? '#ffffff' : colors.bgSecondary,
                          borderColor: selectedForDelete.has(canvas.id) 
                            ? (actualTheme === 'light' ? '#dc2626' : '#fca5a5')
                            : colors.border,
                          color: actualTheme === 'light' ? '#1e293b' : colors.text,
                          boxShadow: actualTheme === 'light' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                          borderWidth: selectedForDelete.has(canvas.id) ? '2px' : '1px'
                        }}
                      >
                        {/* Checkbox for bulk delete mode */}
                        {showBulkDelete && (
                          <input
                            type="checkbox"
                            checked={selectedForDelete.has(canvas.id)}
                            onChange={() => toggleCanvasSelection(canvas.id)}
                            className="mr-3 w-4 h-4"
                            style={{
                              accentColor: actualTheme === 'light' ? '#dc2626' : '#fca5a5'
                            }}
                          />
                        )}
                        
                        {/* Canvas info - clickable when not in bulk delete mode */}
                        <div 
                          className={`flex-1 ${!showBulkDelete ? 'cursor-pointer' : ''}`}
                          onClick={!showBulkDelete ? () => onCanvasSelect(canvas) : undefined}
                        >
                          <div className="flex items-center">
                            <div className="font-medium">{canvas.title}</div>
                            {index === 0 && (
                              <span 
                                className="ml-2 px-2 py-1 text-xs rounded"
                                style={{
                                  backgroundColor: colors.success,
                                  color: actualTheme === 'light' ? 'white' : colors.bg
                                }}
                              >
                                Most Recent
                              </span>
                            )}
                          </div>
                          <div 
                            className="text-sm mt-1"
                            style={{ 
                              color: actualTheme === 'light' ? '#64748b' : colors.textSecondary 
                            }}
                          >
                            Last updated: {formatDate(canvas.updated_at)}
                          </div>
                        </div>
                        
                        {/* Action buttons */}
                        {!showBulkDelete && (
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => handleDeleteCanvas(canvas, e)}
                              className="text-sm px-3 py-2 rounded font-medium transition-colors"
                              style={{
                                backgroundColor: actualTheme === 'light' ? '#fee2e2' : '#7f1d1d',
                                color: actualTheme === 'light' ? '#dc2626' : '#fca5a5',
                                borderColor: actualTheme === 'light' ? '#fecaca' : '#991b1b'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = actualTheme === 'light' ? '#fecaca' : '#991b1b';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = actualTheme === 'light' ? '#fee2e2' : '#7f1d1d';
                              }}
                              title={`Delete "${canvas.title}"`}
                            >
                              🗑️
                            </button>
                            <button
                              onClick={() => onCanvasSelect(canvas)}
                              className="text-sm px-3 py-2 rounded font-medium transition-colors"
                              style={{
                                backgroundColor: colors.primary,
                                color: actualTheme === 'light' ? 'white' : colors.bg
                              }}
                            >
                              Open
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Quick Actions for Existing Canvases */}
                  <div className="mt-4 flex gap-2 text-sm">
                    <button
                      onClick={() => canvases.length > 0 && onCanvasSelect(canvases[0])}
                      className="px-3 py-1 rounded transition-colors"
                      style={{
                        backgroundColor: colors.buttonBg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`
                      }}
                    >
                      🚀 Open Most Recent
                    </button>
                  </div>
                </div>
              )}

              {/* Create New Canvas */}
              <div>
                <h3 
                  className="text-lg font-semibold mb-4"
                  style={{ color: actualTheme === 'light' ? '#1e293b' : colors.text }}
                >
                  Create New Canvas
                </h3>
                
                {!showCreateForm ? (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full p-4 rounded border-2 border-dashed text-center transition-colors"
                    style={{
                      borderColor: actualTheme === 'light' ? '#cbd5e1' : colors.border,
                      color: actualTheme === 'light' ? '#64748b' : colors.textSecondary,
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.primary;
                      e.currentTarget.style.color = colors.primary;
                      e.currentTarget.style.backgroundColor = actualTheme === 'light' ? '#f1f5f9' : colors.bgSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = actualTheme === 'light' ? '#cbd5e1' : colors.border;
                      e.currentTarget.style.color = actualTheme === 'light' ? '#64748b' : colors.textSecondary;
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div className="text-2xl mb-2">+</div>
                    <div>Create New Canvas</div>
                  </button>
                ) : (
                  <div 
                    className="p-4 rounded border"
                    style={{
                      backgroundColor: actualTheme === 'light' ? '#f8fafc' : colors.bgSecondary,
                      borderColor: actualTheme === 'light' ? '#e2e8f0' : colors.border
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Enter canvas title..."
                      value={newCanvasTitle}
                      onChange={(e) => setNewCanvasTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateNew();
                        if (e.key === 'Escape') setShowCreateForm(false);
                      }}
                      className="w-full p-2 mb-3 rounded border"
                      style={{
                        backgroundColor: actualTheme === 'light' ? '#ffffff' : colors.bgPrimary,
                        borderColor: actualTheme === 'light' ? '#d1d5db' : colors.border,
                        color: actualTheme === 'light' ? '#1f2937' : colors.text
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateNew}
                        disabled={!newCanvasTitle.trim()}
                        className="flex-1 px-4 py-2 rounded transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: newCanvasTitle.trim() ? colors.primary : colors.border,
                          color: newCanvasTitle.trim() 
                            ? (actualTheme === 'light' ? 'white' : colors.bg)
                            : colors.textSecondary
                        }}
                      >
                        Create Canvas
                      </button>
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="px-4 py-2 rounded transition-colors"
                        style={{
                          backgroundColor: colors.buttonBg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Skip Option (if provided) */}
              {onSkip && (
                <div className="mt-6 text-center">
                  <button
                    onClick={onSkip}
                    className="text-sm underline transition-colors"
                    style={{ color: colors.textSecondary }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = colors.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = colors.textSecondary;
                    }}
                  >
                    Skip and use default canvas
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
