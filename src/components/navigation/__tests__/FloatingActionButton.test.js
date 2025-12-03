import React from 'react';
import { render, screen, fireEvent } from '../../../utils/test-utils';
import { setupTestMocks } from '../../../utils/test-utils';
import FloatingActionButton from '../FloatingActionButton';

describe('FloatingActionButton', () => {
  beforeEach(() => {
    setupTestMocks();
  });

  it('should not render when scrollY is less than 300', () => {
    const { container } = render(<FloatingActionButton />);
    expect(container.firstChild).toBeNull();
  });

  it('should render after scrolling down 300px', () => {
    render(<FloatingActionButton />);

    // Simulate scroll
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    fireEvent.scroll(window);

    const button = screen.getByRole('button', { name: /quick actions/i });
    expect(button).toBeInTheDocument();
  });

  it('should toggle menu when clicked', () => {
    render(<FloatingActionButton />);

    // Simulate scroll to show FAB
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    fireEvent.scroll(window);

    const mainButton = screen.getByRole('button', { name: /open quick actions menu/i });
    fireEvent.click(mainButton);

    expect(screen.getByRole('button', { name: /scroll to top/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show keyboard shortcuts/i })).toBeInTheDocument();
  });

  it('should call onShowHelp when help button clicked', () => {
    const onShowHelp = jest.fn();
    render(<FloatingActionButton onShowHelp={onShowHelp} />);

    // Simulate scroll to show FAB
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    fireEvent.scroll(window);

    // Open menu
    const mainButton = screen.getByRole('button', { name: /open quick actions menu/i });
    fireEvent.click(mainButton);

    // Click help
    const helpButton = screen.getByRole('button', { name: /show keyboard shortcuts/i });
    fireEvent.click(helpButton);

    expect(onShowHelp).toHaveBeenCalled();
  });

  it('should scroll to top when scroll to top button clicked', () => {
    render(<FloatingActionButton />);

    // Simulate scroll to show FAB
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    fireEvent.scroll(window);

    // Open menu
    const mainButton = screen.getByRole('button', { name: /open quick actions menu/i });
    fireEvent.click(mainButton);

    // Click scroll to top
    const scrollButton = screen.getByRole('button', { name: /scroll to top/i });
    fireEvent.click(scrollButton);

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('should close menu after action', () => {
    render(<FloatingActionButton />);

    // Simulate scroll to show FAB
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    fireEvent.scroll(window);

    // Open menu
    const mainButton = screen.getByRole('button', { name: /open quick actions menu/i });
    fireEvent.click(mainButton);

    // Click scroll to top
    const scrollButton = screen.getByRole('button', { name: /scroll to top/i });
    fireEvent.click(scrollButton);

    // Menu should be closed
    expect(screen.getByRole('button', { name: /open quick actions menu/i })).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(<FloatingActionButton />);

    // Simulate scroll to show FAB
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    fireEvent.scroll(window);

    const button = screen.getByRole('button', { name: /open quick actions menu/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
