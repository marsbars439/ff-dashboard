import React from 'react';
import FantasyFootballApp from './components/FantasyFootballApp';
import AppProviders from './components/AppProviders';
import './App.css';

function App() {
  return (
    <div className="App">
      <AppProviders>
        <FantasyFootballApp />
      </AppProviders>
    </div>
  );
}

export default App;
