import React from 'react';
import { AdminSessionProvider } from '../state/AdminSessionContext';
import { ManagerAuthProvider } from '../state/ManagerAuthContext';
import { KeeperToolsProvider } from '../state/KeeperToolsContext';
import { RuleVotingProvider } from '../state/RuleVotingContext';

const AppProviders = ({ children }) => (
  <AdminSessionProvider>
    <ManagerAuthProvider>
      <KeeperToolsProvider>
        <RuleVotingProvider>{children}</RuleVotingProvider>
      </KeeperToolsProvider>
    </ManagerAuthProvider>
  </AdminSessionProvider>
);

export default AppProviders;
