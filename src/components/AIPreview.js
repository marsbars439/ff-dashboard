import React, { useState, useEffect } from 'react';
import { API } from '../utils/constants';

const AIPreview = () => {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API.BASE_URL}/preview`);
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
  }, []);

  if (loading) {
    return <p>Loading preview...</p>;
  }

  if (error) {
    return <p className="text-red-500">Error: {error}</p>;
  }

  if (!summary) {
    return null;
  }
  const lines = summary
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  return (
    <ul className="space-y-2 text-gray-700">
      {lines.map((line, idx) => (
        <li key={idx} className="flex items-start">
          <span className="h-2 w-2 mt-2 mr-2 rounded-full bg-indigo-500 flex-shrink-0" />
          <span>{line.replace(/^[-*]\s*/, '')}</span>
        </li>
      ))}
    </ul>
  );
};

export default AIPreview;
