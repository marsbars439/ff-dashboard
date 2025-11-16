import React from 'react';
import { Trophy } from 'lucide-react';

const DashboardHeader = ({ tabs, activeTab, onTabChange }) => {
  const normalizedTabs = Array.isArray(tabs) ? tabs : [];
  const handleTabClick = (tabId) => {
    if (typeof onTabChange === 'function') {
      onTabChange(tabId);
    }
  };

  return (
    <div className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">The League Dashboard</h1>
          </div>
          <nav className="flex flex-wrap justify-center sm:justify-end items-center space-x-3 sm:space-x-6">
            {normalizedTabs.map((tab) => {
              const isActive = typeof tab.isActive === 'function'
                ? tab.isActive(activeTab)
                : activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
