/**
 * Shared Tab Navigation Component
 * Reusable tab switcher with active state highlighting
 */
import React from 'react';

/**
 * TabNav Component
 * @param {Object} props
 * @param {Array} props.tabs - Array of tab objects {id, label, isActive?}
 * @param {string} props.activeTab - Currently active tab id
 * @param {function} props.onTabChange - Callback when tab is clicked
 * @returns {JSX.Element}
 */
export default function TabNav({ tabs, activeTab, onTabChange }) {
  return (
    <div className="tab-navigation">
      <div className="tab-buttons">
        {tabs.map(tab => {
          const isActive = tab.isActive
            ? tab.isActive(activeTab)
            : tab.id === activeTab;

          return (
            <button
              key={tab.id}
              className={`tab-button ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              aria-selected={isActive}
              role="tab"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
