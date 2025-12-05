import React, { useEffect, memo } from 'react';

const KeyboardShortcutsModal = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('click', handleClickOutside);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['1'], description: 'Go to Hall of Records' },
        { keys: ['2'], description: 'Go to Rules' },
        { keys: ['3'], description: 'Go to Admin' },
        { keys: ['4'], description: 'Go to Preseason' },
        { keys: ['5'], description: 'Go to Season' },
        { keys: ['6'], description: 'Go to Week' },
      ]
    },
    {
      category: 'Actions',
      items: [
        { keys: ['?'], description: 'Show this help dialog' },
        { keys: ['Esc'], description: 'Close dialog' },
      ]
    }
  ];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <div className="modal-content keyboard-shortcuts-modal">
        <div className="modal-header">
          <h2 id="shortcuts-title" className="modal-title">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="modal-close"
            aria-label="Close keyboard shortcuts dialog"
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
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {shortcuts.map((section) => (
            <div key={section.category} className="shortcuts-section">
              <h3 className="shortcuts-category">{section.category}</h3>
              <div className="shortcuts-list">
                {section.items.map((shortcut, index) => (
                  <div key={index} className="shortcut-item">
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, keyIndex) => (
                        <kbd key={keyIndex} className="shortcut-key">
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <span className="shortcut-description">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <p className="modal-footer-text">
            Press <kbd className="shortcut-key">?</kbd> anytime to view shortcuts
          </p>
        </div>
      </div>
    </div>
  );
};

export default memo(KeyboardShortcutsModal);
