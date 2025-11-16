import React from 'react';
import FantasyFootballApp from './components/FantasyFootballApp';
import { ManagerAuthProvider } from './state/ManagerAuthContext';
import { AdminSessionProvider } from './state/AdminSessionContext';
import { KeeperToolsProvider } from './state/KeeperToolsContext';
import { RuleVotingProvider } from './state/RuleVotingContext';
import './App.css';

function App() {
  return (
    <div className="App">
      <AdminSessionProvider>
        <ManagerAuthProvider>
          <KeeperToolsProvider>
            <RuleVotingProvider>
              <FantasyFootballApp />
            </RuleVotingProvider>
          </KeeperToolsProvider>
        </ManagerAuthProvider>
      </AdminSessionProvider>
    </div>
  );
}

export default App;