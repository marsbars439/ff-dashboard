import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const CollapsibleSection = ({ title, headerRight = null, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-[var(--ff-color-surface-alt)] border border-[var(--ff-color-border)] rounded-[var(--ff-radius-lg)] shadow-[var(--ff-shadow-md)]">
      <button
        className="flex items-center justify-between p-4 sm:p-6 cursor-pointer w-full text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
      >
        <div className="text-lg sm:text-xl font-bold text-slate-50 flex items-center space-x-2">
          {title}
        </div>
        <div className="flex items-center space-x-2 text-slate-200">
          {headerRight && (
            <div onClick={(e) => e.stopPropagation()}>{headerRight}</div>
          )}
          <ChevronDown
            className={`w-5 h-5 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>
      </button>
      {isOpen && (
        <div className="p-4 sm:p-6 pt-0 border-t border-white/10 text-slate-100" role="region">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
