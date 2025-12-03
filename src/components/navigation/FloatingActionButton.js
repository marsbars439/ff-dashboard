import React, { useState, useEffect, memo } from 'react';

const FloatingActionButton = ({ onShowHelp }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Show FAB after scrolling down
  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const handleHelpClick = () => {
    onShowHelp?.();
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fab-container">
      {/* Menu items */}
      <div className={`fab-menu ${isMenuOpen ? 'fab-menu--open' : ''}`}>
        <button
          onClick={scrollToTop}
          className="fab-menu-item"
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
          <span className="fab-menu-label">Top</span>
        </button>

        <button
          onClick={handleHelpClick}
          className="fab-menu-item"
          aria-label="Show keyboard shortcuts"
          title="Show keyboard shortcuts"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="fab-menu-label">Help</span>
        </button>
      </div>

      {/* Main FAB button */}
      <button
        onClick={toggleMenu}
        className={`fab ${isMenuOpen ? 'fab--open' : ''}`}
        aria-label={isMenuOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
        aria-expanded={isMenuOpen}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="fab-icon"
          aria-hidden="true"
        >
          {isMenuOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
};

export default memo(FloatingActionButton);
