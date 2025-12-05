import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminSessionProvider } from '../state/AdminSessionContext';
import { KeeperToolsProvider } from '../state/KeeperToolsContext';
import { RuleVotingProvider } from '../state/RuleVotingContext';

/**
 * Custom render function that includes all necessary providers
 * @param {React.ReactElement} ui - Component to render
 * @param {Object} options - Additional options
 * @param {Object} options.queryClient - Optional custom QueryClient
 * @param {Object} options.initialEntries - Initial router entries
 * @returns {Object} Render result with additional utilities
 */
export function renderWithProviders(
  ui,
  {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
    initialEntries = ['/'],
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AdminSessionProvider>
            <KeeperToolsProvider>
              <RuleVotingProvider>
                {children}
              </RuleVotingProvider>
            </KeeperToolsProvider>
          </AdminSessionProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

/**
 * Mock fetch with custom responses
 * @param {Object} mockResponses - Map of URL patterns to responses
 * @returns {jest.Mock} Mock fetch function
 */
export function createMockFetch(mockResponses = {}) {
  return jest.fn((url) => {
    for (const [pattern, response] of Object.entries(mockResponses)) {
      if (typeof pattern === 'string' && url.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        });
      }
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
}

/**
 * Wait for async operations to complete
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
export const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock window.scrollTo
 */
export function mockScrollTo() {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn(),
  });
}

/**
 * Mock window.matchMedia
 */
export function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

/**
 * Setup common mocks for tests
 */
export function setupTestMocks() {
  mockScrollTo();
  mockMatchMedia();
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { renderWithProviders as render };
