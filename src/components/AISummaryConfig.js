import React, { useState } from 'react';

const AISummaryConfig = ({ API_BASE_URL, onDataUpdate }) => {
  const [refreshingSummary, setRefreshingSummary] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [message, setMessage] = useState(null);

  const refreshSummary = async () => {
    setRefreshingSummary(true);
    try {
      const response = await fetch(`${API_BASE_URL}/summary/refresh`, { method: 'POST' });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Summary refreshed' });
        if (onDataUpdate) onDataUpdate();
      } else {
        const err = await response.json();
        setMessage({ type: 'error', text: err.error || 'Failed to refresh summary' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to refresh summary' });
    } finally {
      setRefreshingSummary(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const refreshPreview = async () => {
    setRefreshingPreview(true);
    try {
      const response = await fetch(`${API_BASE_URL}/preview/refresh`, { method: 'POST' });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Preview refreshed' });
        if (onDataUpdate) onDataUpdate();
      } else {
        const err = await response.json();
        setMessage({ type: 'error', text: err.error || 'Failed to refresh preview' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to refresh preview' });
    } finally {
      setRefreshingPreview(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div>
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="flex space-x-2">
        <button
          onClick={refreshSummary}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={refreshingSummary}
        >
          {refreshingSummary ? 'Refreshing...' : 'Refresh AI Summary'}
        </button>
        <button
          onClick={refreshPreview}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          disabled={refreshingPreview}
        >
          {refreshingPreview ? 'Refreshing...' : 'Refresh Week Preview'}
        </button>
      </div>
    </div>
  );
};

export default AISummaryConfig;
