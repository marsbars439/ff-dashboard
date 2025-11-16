import React from 'react';
import FantasyFootballApp from './components/FantasyFootballApp';
import { ManagerAuthProvider } from './state/ManagerAuthContext';
import './App.css';

function App() {
  return (
    <div className="App">
      <ManagerAuthProvider>
        <FantasyFootballApp />
      </ManagerAuthProvider>
    </div>
  );
}

export default App;