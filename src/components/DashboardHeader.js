import React from 'react';
import { Link } from 'react-router-dom';

const DashboardHeader = ({ tabs, activeTab, onTabChange }) => {
  const normalizedTabs = Array.isArray(tabs) ? tabs : [];
  const handleTabClick = (e, tabId) => {
    // Let the Link handle navigation, but also trigger the callback
    if (typeof onTabChange === 'function') {
      onTabChange(tabId);
    }
  };

  return (
    <div className="bg-[#030717] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <span className="text-3xl sm:text-4xl" role="img" aria-label="football">🏈</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-50">The League Dashboard</h1>
          </div>
          <nav className="flex flex-wrap justify-center sm:justify-end items-center space-x-3 sm:space-x-6" aria-label="Main navigation">
            {normalizedTabs.map((tab) => {
              const isActive = typeof tab.isActive === 'function'
                ? tab.isActive(activeTab)
                : activeTab === tab.id;

              return (
                <Link
                  key={tab.id}
                  to={`/${tab.id}`}
                  onClick={(e) => handleTabClick(e, tab.id)}
                  className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                    isActive ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30' : 'text-slate-300 hover:text-slate-50 hover:bg-white/5'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
