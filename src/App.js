import React from 'react';
import FantasyFootballApp from './components/FantasyFootballApp';
import { ManagerAuthProvider } from './state/ManagerAuthContext';
import { AdminSessionProvider } from './state/AdminSessionContext';
import './App.css';

function App() {
  return (
    <div className="App">
      <AdminSessionProvider>
        <ManagerAuthProvider>
          <FantasyFootballApp />
        </ManagerAuthProvider>
      </AdminSessionProvider>
    </div>
  );
}

export default App;