import React, { useEffect, useMemo, useState } from 'react';

const sanitizeSummaryLines = summary => {
  if (typeof summary !== 'string') {
    return [];
  }

  return summary
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[-*]\s*/, ''));
};

const AISummaryConfig = ({ API_BASE_URL, onDataUpdate }) => {
  const [refreshingSummary, setRefreshingSummary] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [message, setMessage] = useState(null);
  const [summaryLines, setSummaryLines] = useState([]);
  const [previewLines, setPreviewLines] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const [lineLoading, setLineLoading] = useState({});
  const [previewLineLoading, setPreviewLineLoading] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [previewLastUpdated, setPreviewLastUpdated] = useState(null);

  const hasSummaryLines = summaryLines.length > 0;
  const hasPreviewLines = previewLines.length > 0;

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const response = await fetch(`${API_BASE_URL}/summary`);
      if (!response.ok) {
        throw new Error('Failed to load summary');
      }
      const data = await response.json();
      const lines = sanitizeSummaryLines(data.summary);
      setSummaryLines(lines.length ? lines : ['']);
      setLastUpdated(data.updated ? new Date(data.updated).toLocaleString() : null);
    } catch (error) {
      showMessage('error', error.message || 'Failed to load summary');
      setSummaryLines(['']);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const response = await fetch(`${API_BASE_URL}/preview`);
      if (!response.ok) {
        throw new Error('Failed to load preview');
      }
      const data = await response.json();
      const lines = sanitizeSummaryLines(data.summary);
      setPreviewLines(lines.length ? lines : ['']);
      setPreviewLastUpdated(data.updated ? new Date(data.updated).toLocaleString() : null);
    } catch (error) {
      showMessage('error', error.message || 'Failed to load preview');
      setPreviewLines(['']);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE_URL]);

  const joinSummaryLines = useMemo(
    () => summaryLines.map(line => line.trim()).filter(Boolean).join('\n'),
    [summaryLines]
  );

  const joinPreviewLines = useMemo(
    () => previewLines.map(line => line.trim()).filter(Boolean).join('\n'),
    [previewLines]
  );

  const refreshSummary = async () => {
    setRefreshingSummary(true);
    try {
      const response = await fetch(`${API_BASE_URL}/summary/refresh`, { method: 'POST' });
      if (response.ok) {
        const result = await response.json();
        const lines = sanitizeSummaryLines(result.summary);
        setSummaryLines(lines.length ? lines : ['']);
        setLastUpdated(new Date().toLocaleString());
        showMessage('success', 'Summary refreshed');
        if (onDataUpdate) onDataUpdate();
      } else {
        const err = await response.json();
        showMessage('error', err.error || 'Failed to refresh summary');
      }
    } catch (error) {
      showMessage('error', 'Failed to refresh summary');
    } finally {
      setRefreshingSummary(false);
    }
  };

  const refreshPreview = async () => {
    setRefreshingPreview(true);
    try {
      const response = await fetch(`${API_BASE_URL}/preview/refresh`, { method: 'POST' });
      if (response.ok) {
        const result = await response.json();
        const lines = sanitizeSummaryLines(result.summary);
        setPreviewLines(lines.length ? lines : ['']);
        setPreviewLastUpdated(new Date().toLocaleString());
        showMessage('success', 'Preview refreshed');
        if (onDataUpdate) onDataUpdate();
      } else {
        const err = await response.json();
        showMessage('error', err.error || 'Failed to refresh preview');
      }
    } catch (error) {
      showMessage('error', 'Failed to refresh preview');
    } finally {
      setRefreshingPreview(false);
    }
  };

  const handleSaveSummary = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: joinSummaryLines })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save summary');
      }

      const result = await response.json();
      const lines = Array.isArray(result.lines) && result.lines.length
        ? result.lines
        : sanitizeSummaryLines(result.summary);
      setSummaryLines(lines.length ? lines : ['']);
      setLastUpdated(new Date().toLocaleString());
      showMessage('success', 'Summary saved');
      if (onDataUpdate) onDataUpdate();
    } catch (error) {
      showMessage('error', error.message || 'Failed to save summary');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreview = async () => {
    setSavingPreview(true);
    try {
      const response = await fetch(`${API_BASE_URL}/preview`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: joinPreviewLines })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save preview');
      }

      const result = await response.json();
      const lines = Array.isArray(result.lines) && result.lines.length
        ? result.lines
        : sanitizeSummaryLines(result.summary);
      setPreviewLines(lines.length ? lines : ['']);
      setPreviewLastUpdated(new Date().toLocaleString());
      showMessage('success', 'Preview saved');
      if (onDataUpdate) onDataUpdate();
    } catch (error) {
      showMessage('error', error.message || 'Failed to save preview');
    } finally {
      setSavingPreview(false);
    }
  };

  const handleLineChange = (index, value) => {
    setSummaryLines(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handlePreviewLineChange = (index, value) => {
    setPreviewLines(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleGenerateLine = async index => {
    setLineLoading(prev => ({ ...prev, [index]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/summary/generate-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate summary line');
      }

      const result = await response.json();
      const sanitizedLine = result.line ? result.line.trim() : '';
      setSummaryLines(prev => {
        const updated = [...prev];
        if (index >= updated.length) {
          const padding = new Array(index - updated.length + 1).fill('');
          updated.push(...padding);
        }
        updated[index] = sanitizedLine;
        return updated;
      });
      showMessage('success', `Generated bullet ${index + 1}`);
    } catch (error) {
      showMessage('error', error.message || 'Failed to generate summary line');
    } finally {
      setLineLoading(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleGeneratePreviewLine = async index => {
    setPreviewLineLoading(prev => ({ ...prev, [index]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/preview/generate-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate preview line');
      }

      const result = await response.json();
      const sanitizedLine = result.line ? result.line.trim() : '';
      setPreviewLines(prev => {
        const updated = [...prev];
        if (index >= updated.length) {
          const padding = new Array(index - updated.length + 1).fill('');
          updated.push(...padding);
        }
        updated[index] = sanitizedLine;
        return updated;
      });
      showMessage('success', `Generated preview bullet ${index + 1}`);
    } catch (error) {
      showMessage('error', error.message || 'Failed to generate preview line');
    } finally {
      setPreviewLineLoading(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleAddLine = () => {
    setSummaryLines(prev => [...prev, '']);
  };

  const handleRemoveLine = index => {
    setSummaryLines(prev => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleAddPreviewLine = () => {
    setPreviewLines(prev => [...prev, '']);
  };

  const handleRemovePreviewLine = index => {
    setPreviewLines(prev => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  return (
    <div className="space-y-6">
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
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Weekly Summary Bullets</p>
            {lastUpdated && (
              <span className="text-xs text-gray-500">Last updated: {lastUpdated}</span>
            )}
          </div>
          {loadingSummary && !hasSummaryLines ? (
            <p className="text-sm text-gray-500">Loading summary...</p>
          ) : (
            <div className="space-y-3">
              {summaryLines.map((line, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Bullet {idx + 1}</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleGenerateLine(idx)}
                        className="px-2 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
                        disabled={Boolean(lineLoading[idx])}
                      >
                        {lineLoading[idx] ? 'Generating…' : 'Generate'}
                      </button>
                      {summaryLines.length > 1 && (
                        <button
                          onClick={() => handleRemoveLine(idx)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={line}
                    onChange={e => handleLineChange(idx, e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder={`Bullet ${idx + 1} text`}
                  />
                </div>
              ))}
              <button
                onClick={handleAddLine}
                className="px-3 py-2 text-sm text-indigo-600 bg-white border border-dashed border-indigo-300 rounded hover:bg-indigo-50"
              >
                + Add bullet
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveSummary}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Summary'}
          </button>
          <button
            onClick={refreshSummary}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={refreshingSummary}
          >
            {refreshingSummary ? 'Refreshing…' : 'Refresh AI Summary'}
          </button>
        </div>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Upcoming Preview Bullets</p>
            {previewLastUpdated && (
              <span className="text-xs text-gray-500">Last updated: {previewLastUpdated}</span>
            )}
          </div>
          {loadingPreview && !hasPreviewLines ? (
            <p className="text-sm text-gray-500">Loading preview...</p>
          ) : (
            <div className="space-y-3">
              {previewLines.map((line, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-purple-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Bullet {idx + 1}</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleGeneratePreviewLine(idx)}
                        className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                        disabled={Boolean(previewLineLoading[idx])}
                      >
                        {previewLineLoading[idx] ? 'Generating…' : 'Generate'}
                      </button>
                      {previewLines.length > 1 && (
                        <button
                          onClick={() => handleRemovePreviewLine(idx)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={line}
                    onChange={e => handlePreviewLineChange(idx, e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                    placeholder={`Preview bullet ${idx + 1} text`}
                  />
                </div>
              ))}
              <button
                onClick={handleAddPreviewLine}
                className="px-3 py-2 text-sm text-purple-600 bg-white border border-dashed border-purple-300 rounded hover:bg-purple-50"
              >
                + Add bullet
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSavePreview}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            disabled={savingPreview}
          >
            {savingPreview ? 'Saving…' : 'Save Preview'}
          </button>
          <button
            onClick={refreshPreview}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            disabled={refreshingPreview}
          >
            {refreshingPreview ? 'Refreshing…' : 'Refresh AI Preview'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISummaryConfig;
