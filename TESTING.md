# Testing Guide

This document outlines the testing infrastructure and best practices for the Fantasy Football Dashboard.

## 📋 Table of Contents

- [Overview](#overview)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [CI/CD Pipeline](#cicd-pipeline)
- [Coverage Reports](#coverage-reports)

## Overview

Our testing strategy includes three layers:

1. **Unit Tests** - Test individual functions and utilities (Jest)
2. **Component Tests** - Test React components in isolation (React Testing Library)
3. **E2E Tests** - Test full user journeys (Playwright)

## Running Tests

### Unit & Component Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### E2E Tests

```bash
# Run E2E tests (headless)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# View last test report
npm run test:e2e:report
```

### Linting

```bash
# Run ESLint
npm run lint
```

## Test Structure

```
ff-dashboard/
├── src/
│   ├── components/
│   │   └── navigation/
│   │       ├── __tests__/
│   │       │   ├── Breadcrumbs.test.js
│   │       │   ├── FloatingActionButton.test.js
│   │       │   └── KeyboardShortcutsModal.test.js
│   │       ├── Breadcrumbs.js
│   │       ├── FloatingActionButton.js
│   │       └── KeyboardShortcutsModal.js
│   └── utils/
│       ├── __tests__/
│       │   └── performance.test.js
│       ├── performance.js
│       └── test-utils.js
├── e2e/
│   └── navigation.spec.js
└── playwright.config.js
```

## Writing Tests

### Unit Tests

Use Jest for testing utility functions:

```javascript
import { debounce } from '../performance';

describe('debounce', () => {
  it('should delay function execution', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

### Component Tests

Use React Testing Library with our custom render function:

```javascript
import { render, screen, fireEvent } from '../../../utils/test-utils';
import FloatingActionButton from '../FloatingActionButton';

describe('FloatingActionButton', () => {
  it('should toggle menu when clicked', () => {
    render(<FloatingActionButton />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('Scroll to Top')).toBeVisible();
  });
});
```

### E2E Tests

Use Playwright for end-to-end user journeys:

```javascript
const { test, expect } = require('@playwright/test');

test('should navigate between tabs', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Rules' }).click();
  await expect(page).toHaveURL('/rules');
});
```

## Test Utilities

### Custom Render

Use `renderWithProviders` from `test-utils.js` to render components with all necessary providers:

```javascript
import { renderWithProviders as render } from '../utils/test-utils';

render(<MyComponent />);
```

### Mock Fetch

Use `createMockFetch` to mock API calls:

```javascript
import { createMockFetch } from '../utils/test-utils';

global.fetch = createMockFetch({
  '/api/managers': { managers: [] },
  '/api/team-seasons': { teamSeasons: [] }
});
```

### Setup Mocks

Use `setupTestMocks` to initialize common mocks:

```javascript
import { setupTestMocks } from '../utils/test-utils';

beforeEach(() => {
  setupTestMocks();
});
```

## CI/CD Pipeline

Our GitHub Actions workflow runs on every push and pull request:

### Stages

1. **Test & Lint** - Runs unit/component tests and linting
2. **Build** - Creates production build
3. **E2E Tests** - Runs Playwright tests
4. **Lighthouse** - Performance audits
5. **Security** - npm audit for vulnerabilities

### Coverage Upload

Test coverage is automatically uploaded to Codecov on push to main branches.

### Artifacts

- Build artifacts (7 days)
- Playwright reports (7 days)
- Coverage reports (uploaded to Codecov)
- Security audit results (30 days)

## Coverage Reports

### Viewing Coverage Locally

After running `npm run test:coverage`, open:

```
coverage/lcov-report/index.html
```

### Coverage Thresholds

Minimum coverage requirements:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

Tests will fail if coverage drops below these thresholds.

### Excluding Files from Coverage

Add patterns to `package.json`:

```json
"jest": {
  "collectCoverageFrom": [
    "src/**/*.{js,jsx}",
    "!src/**/*.test.{js,jsx}",
    "!src/index.js"
  ]
}
```

## Best Practices

### Unit Tests

- Test one thing at a time
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Use fake timers for time-based functions

### Component Tests

- Test user interactions, not implementation details
- Use `screen.getByRole` for better accessibility
- Test both happy path and error states
- Mock API calls
- Clean up after each test

### E2E Tests

- Test critical user journeys
- Use page object pattern for complex flows
- Keep tests independent
- Use proper wait strategies
- Test across multiple viewports

### General

- Write tests before or alongside features
- Keep tests simple and readable
- Don't test third-party libraries
- Avoid testing implementation details
- Run tests before committing

## Troubleshooting

### Tests timing out

Increase timeout in test file:

```javascript
test('slow test', async ({ page }) => {
  // ...
}, 60000); // 60 second timeout
```

### Flaky E2E tests

Use proper wait strategies:

```javascript
await expect(page.getByText('Loading...')).toBeHidden();
await expect(page.getByText('Content')).toBeVisible();
```

### Mock not working

Ensure mocks are set up before component renders:

```javascript
beforeEach(() => {
  global.fetch = jest.fn();
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Best Practices](https://testingjavascript.com/)

## Contributing

When adding new features:

1. Write tests first (TDD) or alongside implementation
2. Ensure all tests pass locally
3. Check coverage hasn't decreased
4. Run E2E tests for user-facing changes
5. Update this guide if adding new testing patterns
