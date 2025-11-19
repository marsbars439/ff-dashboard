import React from 'react';
import FantasyFootballApp from './components/FantasyFootballApp';
import AppProviders from './components/AppProviders';
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
    <MainLayout>
      <AppProviders>
        <FantasyFootballApp />
      </AppProviders>
    </MainLayout>
  );
}

export default App;
