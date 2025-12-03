import React, { memo, useState } from 'react';
import { Link } from 'react-router-dom';

const TabLink = memo(({ tab, activeTab, onTabClick, isMobile }) => {
  const isActive = typeof tab.isActive === 'function'
    ? tab.isActive(activeTab)
    : activeTab === tab.id;

  return (
    <Link
      key={tab.id}
      to={`/${tab.id}`}
      onClick={(e) => onTabClick(e, tab.id)}
      className={`header-nav-link ${isActive ? 'active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {tab.label}
    </Link>
  );
});

const DashboardHeader = ({ tabs, activeTab, onTabChange }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const normalizedTabs = Array.isArray(tabs) ? tabs : [];

  const handleTabClick = (e, tabId) => {
    setIsMobileMenuOpen(false);
    if (typeof onTabChange === 'function') {
      onTabChange(tabId);
    }
  };

  return (
    <div className="dashboard-header">
      <div className="dashboard-header__container">
        {/* Logo and Title */}
        <Link to="/records" className="dashboard-header__brand" onClick={() => setIsMobileMenuOpen(false)}>
          <span className="dashboard-header__logo" role="img" aria-label="football">🏈</span>
          <h1 className="dashboard-header__title">The League</h1>
        </Link>

        {/* Desktop Navigation */}
        <nav className="dashboard-header__nav" aria-label="Main navigation">
          {normalizedTabs.map(tab => (
            <TabLink key={tab.id} tab={tab} activeTab={activeTab} onTabClick={handleTabClick} />
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="dashboard-header__menu-button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-expanded={isMobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {isMobileMenuOpen && (
        <nav className="dashboard-header__mobile-nav" aria-label="Mobile navigation">
          {normalizedTabs.map(tab => (
            <TabLink key={tab.id} tab={tab} activeTab={activeTab} onTabClick={handleTabClick} isMobile />
          ))}
        </nav>
      )}
    </div>
  );
};

export default memo(DashboardHeader);
