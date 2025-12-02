import React, { useState, useEffect } from 'react';
import { API } from '../utils/constants';
import { SkeletonText } from '../shared/components';

const AISummary = () => {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Delay AI summary fetch to prioritize critical content (progressive loading)
    const timeout = setTimeout(() => {
      const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`${API.BASE_URL}/summary`);
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          const result = await response.json();
          setSummary(result.summary || '');
        } catch (err) {
          setError(err.message || 'An error occurred');
        } finally {
          setLoading(false);
        }
      };

      fetchSummary();
    }, 300); // 300ms delay for progressive loading

    return () => clearTimeout(timeout);
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-start space-x-2">
          <div className="h-2 w-2 mt-2 rounded-full bg-gray-300 flex-shrink-0" />
          <SkeletonText lines={1} />
        </div>
        <div className="flex items-start space-x-2">
          <div className="h-2 w-2 mt-2 rounded-full bg-gray-300 flex-shrink-0" />
          <SkeletonText lines={1} />
        </div>
        <div className="flex items-start space-x-2">
          <div className="h-2 w-2 mt-2 rounded-full bg-gray-300 flex-shrink-0" />
          <SkeletonText lines={1} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm" style={{ color: 'var(--ff-color-text-muted)' }}>
        AI summary temporarily unavailable
      </p>
    );
  }

  if (!summary) {
    return null;
  }
  const lines = summary
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  return (
    <ul className="space-y-1.5 sm:space-y-2 text-gray-700">
      {lines.map((line, idx) => (
        <li key={idx} className="flex items-start">
          <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 mt-1.5 sm:mt-2 mr-1.5 sm:mr-2 rounded-full bg-indigo-500 flex-shrink-0" />
          <span className="text-xs sm:text-sm">{line.replace(/^[-*]\s*/, '')}</span>
        </li>
      ))}
    </ul>
  );
};

export default AISummary;
