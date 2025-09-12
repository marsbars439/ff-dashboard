import React, { useState, useEffect } from 'react';

const AIPreview = () => {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/preview');
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
    <ul className="list-disc list-inside space-y-1">
      {lines.map((line, idx) => (
        <li key={idx}>{line.replace(/^[-*]\s*/, '')}</li>
      ))}
    </ul>
  );
};

export default AIPreview;
