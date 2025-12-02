import React from 'react';
import FantasyFootballApp from './components/FantasyFootballApp';
import AppProviders from './components/AppProviders';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const MainLayout = ({ children }) => (
  <div className="App theme-dark">
    <div className="app-shell">
      <div className="layout-container">
        {children}
      </div>
    </div>
  </div>
);

function App() {
  return (
    <ErrorBoundary
      title="Fantasy Football Dashboard Error"
      message="We encountered an unexpected error. Please refresh the page or contact support if the problem persists."
    >
      <MainLayout>
        <AppProviders>
          <ErrorBoundary>
            <FantasyFootballApp />
          </ErrorBoundary>
        </AppProviders>
      </MainLayout>
    </ErrorBoundary>
  );
}

export default App;
