import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const CollapsibleSection = ({ title, headerRight = null, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900/70 border border-white/10 rounded-2xl shadow-lg backdrop-blur">
      <div
        className="flex items-center justify-between p-4 sm:p-6 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
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
          />
        </div>
      </div>
      {isOpen && (
        <div className="p-4 sm:p-6 pt-0 border-t border-white/10 text-slate-100">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
