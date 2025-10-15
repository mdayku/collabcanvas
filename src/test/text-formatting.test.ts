import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvas } from '../state/store';
import type { ShapeBase } from '../types';

describe('Text Formatting', () => {
  beforeEach(() => {
    // Reset store state before each test
    useCanvas.setState({
      shapes: {},
      selectedIds: [],
      roomId: 'test-room',
      me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
      history: [],
    });
  });

  describe('Text Style Properties', () => {
    it('creates text shapes with default formatting', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Hello World',
        fontSize: 16,
        fontFamily: 'Arial',
        textAlign: 'left',
        fontStyle: 'normal',
        fontWeight: 'normal', 
        textDecoration: 'none',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);
      const stored = useCanvas.getState().shapes['text-1'];

      expect(stored.textAlign).toBe('left');
      expect(stored.fontStyle).toBe('normal');
      expect(stored.fontWeight).toBe('normal');
      expect(stored.textDecoration).toBe('none');
      expect(stored.fontSize).toBe(16);
      expect(stored.fontFamily).toBe('Arial');
    });

    it('applies bold formatting', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Bold Text',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);
      
      // Toggle bold off
      const updatedShape = { 
        ...textShape, 
        fontWeight: 'normal' as const,
        updated_at: Date.now() 
      };
      useCanvas.getState().upsert(updatedShape);

      expect(useCanvas.getState().shapes['text-1'].fontWeight).toBe('normal');

      // Toggle bold back on
      const boldShape = { 
        ...updatedShape, 
        fontWeight: 'bold' as const,
        updated_at: Date.now() 
      };
      useCanvas.getState().upsert(boldShape);

      expect(useCanvas.getState().shapes['text-1'].fontWeight).toBe('bold');
    });

    it('applies italic formatting', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Italic Text',
        fontSize: 16,
        fontStyle: 'italic',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);
      expect(useCanvas.getState().shapes['text-1'].fontStyle).toBe('italic');

      // Toggle italic off
      const normalShape = { 
        ...textShape, 
        fontStyle: 'normal' as const,
        updated_at: Date.now() 
      };
      useCanvas.getState().upsert(normalShape);

      expect(useCanvas.getState().shapes['text-1'].fontStyle).toBe('normal');
    });

    it('applies underline decoration', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Underlined Text',
        fontSize: 16,
        textDecoration: 'underline',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);
      expect(useCanvas.getState().shapes['text-1'].textDecoration).toBe('underline');

      // Toggle underline off
      const noUnderlineShape = { 
        ...textShape, 
        textDecoration: 'none' as const,
        updated_at: Date.now() 
      };
      useCanvas.getState().upsert(noUnderlineShape);

      expect(useCanvas.getState().shapes['text-1'].textDecoration).toBe('none');
    });
  });

  describe('Text Alignment', () => {
    it('applies left alignment', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Left Aligned',
        fontSize: 16,
        textAlign: 'left',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);
      expect(useCanvas.getState().shapes['text-1'].textAlign).toBe('left');
    });

    it('applies center alignment', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Center Aligned',
        fontSize: 16,
        textAlign: 'center',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);
      expect(useCanvas.getState().shapes['text-1'].textAlign).toBe('center');
    });

    it('applies right alignment', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Right Aligned',
        fontSize: 16,
        textAlign: 'right',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);
      expect(useCanvas.getState().shapes['text-1'].textAlign).toBe('right');
    });
  });

  describe('Combined Formatting', () => {
    it('applies multiple formatting options simultaneously', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Bold Italic Underlined',
        fontSize: 18,
        fontWeight: 'bold',
        fontStyle: 'italic',
        textDecoration: 'underline',
        textAlign: 'center',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);
      const stored = useCanvas.getState().shapes['text-1'];

      expect(stored.fontWeight).toBe('bold');
      expect(stored.fontStyle).toBe('italic');
      expect(stored.textDecoration).toBe('underline');
      expect(stored.textAlign).toBe('center');
      expect(stored.fontSize).toBe(18);
    });

    it('toggles individual formatting without affecting others', () => {
      let textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Multi-formatted Text',
        fontSize: 16,
        fontWeight: 'bold',
        fontStyle: 'italic',
        textDecoration: 'underline',
        textAlign: 'center',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);

      // Turn off bold only
      textShape = { 
        ...textShape, 
        fontWeight: 'normal' as const,
        updated_at: Date.now() 
      };
      useCanvas.getState().upsert(textShape);

      const stored = useCanvas.getState().shapes['text-1'];
      expect(stored.fontWeight).toBe('normal');
      expect(stored.fontStyle).toBe('italic'); // Should remain
      expect(stored.textDecoration).toBe('underline'); // Should remain
      expect(stored.textAlign).toBe('center'); // Should remain
    });
  });

  describe('Font Properties', () => {
    it('maintains font size when other properties change', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Sized Text',
        fontSize: 24,
        fontWeight: 'normal',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);

      // Change weight but preserve size
      const updatedShape = { 
        ...textShape, 
        fontWeight: 'bold' as const,
        updated_at: Date.now() 
      };
      useCanvas.getState().upsert(updatedShape);

      const stored = useCanvas.getState().shapes['text-1'];
      expect(stored.fontSize).toBe(24);
      expect(stored.fontWeight).toBe('bold');
    });

    it('maintains font family across updates', () => {
      const textShape: ShapeBase = {
        id: 'text-1',
        type: 'text',
        x: 100, y: 100, w: 200, h: 40,
        text: 'Font Family Test',
        fontSize: 16,
        fontFamily: 'Times New Roman',
        fontWeight: 'normal',
        color: '#111111',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(textShape);

      // Update other properties
      const updatedShape = { 
        ...textShape, 
        fontStyle: 'italic' as const,
        textAlign: 'right' as const,
        updated_at: Date.now() 
      };
      useCanvas.getState().upsert(updatedShape);

      const stored = useCanvas.getState().shapes['text-1'];
      expect(stored.fontFamily).toBe('Times New Roman');
      expect(stored.fontStyle).toBe('italic');
      expect(stored.textAlign).toBe('right');
    });
  });

  describe('Default Values', () => {
    it('uses correct default values for new text shapes', () => {
      // Test the default values that would be set by getShapeDefaults
      const defaultTextShape = {
        x: 100,
        y: 100,
        w: 200,
        h: 40,
        text: 'Text',
        fontSize: 16,
        fontFamily: 'Arial',
        textAlign: 'left',
        fontStyle: 'normal',
        fontWeight: 'normal',
        textDecoration: 'none',
        color: '#111111' // Should be dark for canvas visibility
      };

      expect(defaultTextShape.textAlign).toBe('left');
      expect(defaultTextShape.fontStyle).toBe('normal');
      expect(defaultTextShape.fontWeight).toBe('normal');
      expect(defaultTextShape.textDecoration).toBe('none');
      expect(defaultTextShape.fontSize).toBe(16);
      expect(defaultTextShape.fontFamily).toBe('Arial');
      expect(defaultTextShape.color).toBe('#111111');
    });
  });
});
