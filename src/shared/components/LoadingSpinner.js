/**
 * Shared Loading Spinner Component
 * Displays a loading indicator with optional message
 */
import React from 'react';

/**
 * LoadingSpinner Component
 * @param {Object} props
 * @param {string} props.message - Optional loading message to display
 * @returns {JSX.Element}
 */
export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="loading-spinner">
      <div className="spinner-icon"></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
}
