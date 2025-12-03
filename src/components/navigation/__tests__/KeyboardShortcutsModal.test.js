import React from 'react';
import { render, screen, fireEvent } from '../../../utils/test-utils';
import KeyboardShortcutsModal from '../KeyboardShortcutsModal';

describe('KeyboardShortcutsModal', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(<KeyboardShortcutsModal isOpen={false} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('should display navigation shortcuts', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Go to Hall of Records')).toBeInTheDocument();
    expect(screen.getByText('Go to Rules')).toBeInTheDocument();
    expect(screen.getByText('Go to Admin')).toBeInTheDocument();
  });

  it('should display action shortcuts', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Show this help dialog')).toBeInTheDocument();
    expect(screen.getByText('Close dialog')).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close keyboard shortcuts/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when Escape key pressed', () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking overlay', () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={onClose} />);

    const overlay = screen.getByRole('dialog').parentElement;
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalled();
  });

  it('should not close when clicking modal content', () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should prevent body scroll when open', () => {
    const { rerender } = render(<KeyboardShortcutsModal isOpen={false} onClose={jest.fn()} />);
    expect(document.body.style.overflow).toBe('');

    rerender(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<KeyboardShortcutsModal isOpen={false} onClose={jest.fn()} />);
    expect(document.body.style.overflow).toBe('');
  });

  it('should have proper accessibility attributes', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'shortcuts-title');
  });

  it('should display keyboard key badges', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={jest.fn()} />);

    // Check that navigation shortcuts are displayed with key badges
    expect(screen.getByText('Go to Hall of Records')).toBeInTheDocument();
    expect(screen.getByText('Go to Rules')).toBeInTheDocument();
  });
});
