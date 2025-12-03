import React from 'react';
import { render, screen } from '../../../utils/test-utils';
import Breadcrumbs from '../Breadcrumbs';

describe('Breadcrumbs', () => {
  it('should render nothing when no items provided', () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render single breadcrumb item', () => {
    const items = [
      { id: 'home', label: 'Home' }
    ];

    render(<Breadcrumbs items={items} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('should render multiple breadcrumb items with links', () => {
    const items = [
      { id: 'home', label: 'Home', path: '/' },
      { id: 'page', label: 'Page' }
    ];

    render(<Breadcrumbs items={items} />);

    const homeLink = screen.getByRole('link', { name: /go to home/i });
    expect(homeLink).toHaveAttribute('href', '/');
    expect(screen.getByText('Page')).toBeInTheDocument();
  });

  it('should mark last item as current page', () => {
    const items = [
      { id: 'home', label: 'Home', path: '/' },
      { id: 'page', label: 'Current Page' }
    ];

    render(<Breadcrumbs items={items} />);

    const currentPage = screen.getByText('Current Page');
    expect(currentPage).toHaveAttribute('aria-current', 'page');
  });

  it('should render separators between items', () => {
    const items = [
      { id: 'home', label: 'Home', path: '/' },
      { id: 'page1', label: 'Page 1', path: '/page1' },
      { id: 'page2', label: 'Page 2' }
    ];

    const { container } = render(<Breadcrumbs items={items} />);

    const separators = container.querySelectorAll('.breadcrumbs__separator');
    expect(separators).toHaveLength(2);
  });

  it('should have proper accessibility attributes', () => {
    const items = [
      { id: 'home', label: 'Home', path: '/' },
      { id: 'page', label: 'Current' }
    ];

    render(<Breadcrumbs items={items} />);

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();
  });
});
