import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const CollapsibleSection = ({ title, headerRight = null, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-lg">
      <div
        className="flex items-center justify-between p-4 sm:p-6 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="text-lg sm:text-xl font-bold text-gray-900 flex items-center space-x-2">
          {title}
        </div>
        <div className="flex items-center space-x-2">
          {headerRight && (
            <div onClick={(e) => e.stopPropagation()}>{headerRight}</div>
          )}
          <ChevronDown
            className={`w-5 h-5 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          />
        </div>
      </div>
      {isOpen && (
        <div className="p-4 sm:p-6 pt-0 border-t">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
