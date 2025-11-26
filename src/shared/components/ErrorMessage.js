/**
 * Shared Error Message Component
 * Displays error messages with consistent styling
 */
import React from 'react';

/**
 * ErrorMessage Component
 * @param {Object} props
 * @param {string} props.message - Error message to display
 * @param {function} props.onRetry - Optional retry callback
 * @returns {JSX.Element}
 */
export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="error-message">
      <div className="error-icon">⚠️</div>
      <p className="error-text">{message}</p>
      {onRetry && (
        <button className="retry-button" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
