import React from 'react';

/**
 * Error Boundary component to catch React rendering errors
 * Usage: Wrap components that might error
 * <ErrorBoundary fallback={<CustomError />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }

    // You can also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--ff-color-bg)' }}>
          <div className="max-w-md w-full card-primary">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-500/20 rounded-full border-2 border-red-500/50">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-center" style={{ color: 'var(--ff-color-text-strong)' }}>
              {this.props.title || 'Something went wrong'}
            </h2>
            <p className="mt-3 text-base text-center" style={{ color: 'var(--ff-color-text-muted)' }}>
              {this.props.message || 'An unexpected error occurred. Please try refreshing the page or returning to the home screen.'}
            </p>

            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details className="mt-6 p-4 rounded border" style={{ background: 'var(--ff-color-surface-muted)', borderColor: 'var(--ff-color-border)' }}>
                <summary className="cursor-pointer text-sm font-semibold" style={{ color: 'var(--ff-color-text)' }}>
                  Error Details (Development Only)
                </summary>
                <pre className="mt-3 text-xs text-red-400 overflow-auto max-h-64 p-2 rounded" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 px-6 py-3 rounded-lg font-semibold transition-colors shadow-md"
                style={{
                  background: 'var(--ff-color-surface-muted)',
                  color: 'var(--ff-color-text)',
                  border: '1px solid var(--ff-color-border)'
                }}
              >
                Go Home
              </button>
            </div>

            <p className="mt-4 text-xs text-center" style={{ color: 'var(--ff-color-text-subtle)' }}>
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
