import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '../utils/queryClient';
import { AdminSessionProvider } from '../state/AdminSessionContext';
import { ManagerAuthProvider } from '../state/ManagerAuthContext';
import { KeeperToolsProvider } from '../state/KeeperToolsContext';
import { RuleVotingProvider } from '../state/RuleVotingContext';

const AppProviders = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <AdminSessionProvider>
      <ManagerAuthProvider>
        <KeeperToolsProvider>
          <RuleVotingProvider>
            {children}
          </RuleVotingProvider>
        </KeeperToolsProvider>
      </ManagerAuthProvider>
    </AdminSessionProvider>
    {process.env.NODE_ENV === 'development' && (
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    )}
  </QueryClientProvider>
);

export default AppProviders;
