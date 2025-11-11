import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Save, X, Trash2, Edit3 } from 'lucide-react';

const toUniqueOptions = (text) => {
  if (typeof text !== 'string') {
    return [];
  }

  const trimmed = text
    .split('\n')
    .map(option => option.trim())
    .filter(option => option.length > 0);

  return Array.from(new Set(trimmed));
};

const RuleChangeAdmin = ({
  seasonYear,
  proposals = [],
  onCreateProposal,
  onUpdateProposal,
  onDeleteProposal,
  isLoading = false,
  error = null
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newOptions, setNewOptions] = useState('Yes\nNo');
  const [newSeasonYear, setNewSeasonYear] = useState(seasonYear || '');
  const [formError, setFormError] = useState(null);
  const [formStatus, setFormStatus] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', options: '', seasonYear: seasonYear || '' });
  const [editError, setEditError] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [actionStatus, setActionStatus] = useState(null);

  useEffect(() => {
    if (seasonYear != null) {
      setNewSeasonYear(seasonYear);
    }
  }, [seasonYear]);

  const seasonLabel = useMemo(() => {
    if (newSeasonYear === '' || newSeasonYear == null) {
      return '';
    }
    const numeric = Number(newSeasonYear);
    return Number.isFinite(numeric) ? `${numeric + 1} Season` : '';
  }, [newSeasonYear]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError(null);
    setFormStatus(null);

    const parsedOptions = toUniqueOptions(newOptions);
    if (parsedOptions.length < 2) {
      setFormError('Please provide at least two unique options.');
      return;
    }

    const numericYear = Number(newSeasonYear);
    if (!Number.isInteger(numericYear)) {
      setFormError('Please provide a valid season year.');
      return;
    }

    if (typeof onCreateProposal !== 'function') {
      return;
    }

    try {
      setIsCreating(true);
      await onCreateProposal({
        seasonYear: numericYear,
        title: newTitle.trim(),
        description: newDescription.trim(),
        options: parsedOptions
      });
      setNewTitle('');
      setNewDescription('');
      setNewOptions('Yes\nNo');
      setFormStatus('Proposal created successfully.');
    } catch (err) {
      setFormError(err?.message || 'Unable to create proposal.');
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (proposal) => {
    setEditingId(proposal.id);
    setEditForm({
      title: proposal.title,
      description: proposal.description || '',
      options: proposal.options.map(option => option.value).join('\n'),
      seasonYear: proposal.seasonYear
    });
    setEditError(null);
    setActionStatus(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ title: '', description: '', options: '', seasonYear: seasonYear || '' });
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingId || typeof onUpdateProposal !== 'function') {
      return;
    }

    const parsedOptions = toUniqueOptions(editForm.options);
    if (parsedOptions.length < 2) {
      setEditError('Please provide at least two unique options.');
      return;
    }

    const numericYear = Number(editForm.seasonYear);
    if (!Number.isInteger(numericYear)) {
      setEditError('Please provide a valid season year.');
      return;
    }

    try {
      setIsSavingEdit(true);
      await onUpdateProposal(editingId, {
        seasonYear: numericYear,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        options: parsedOptions
      });
      setActionStatus('Proposal updated successfully.');
      cancelEditing();
    } catch (err) {
      setEditError(err?.message || 'Unable to update proposal.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteProposal = async (proposalId) => {
    if (typeof onDeleteProposal !== 'function') {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm('Delete this proposal? This cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(proposalId);
      await onDeleteProposal(proposalId);
      setActionStatus('Proposal deleted.');
    } catch (err) {
      setActionStatus(err?.message || 'Unable to delete proposal.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Plus className="mr-2 h-5 w-5 text-blue-500" /> Create a New Proposal
          </h3>
          {seasonLabel && (
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {seasonLabel}
            </span>
          )}
        </div>
        {formStatus && (
          <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {formStatus}
          </div>
        )}
        {formError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Season Year
            </label>
            <input
              type="number"
              value={newSeasonYear ?? ''}
              onChange={event => setNewSeasonYear(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="2023"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Displayed on the Preseason tab as the following season.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Example: Switch to Superflex"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Description</label>
            <textarea
              value={newDescription}
              onChange={event => setNewDescription(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              rows={3}
              placeholder="Provide background info, rationale, or how the change would be implemented."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Voting Options
            </label>
            <textarea
              value={newOptions}
              onChange={event => setNewOptions(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              rows={3}
              placeholder={'Yes\nNo'}
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter each option on its own line. Duplicate entries are ignored.
            </p>
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-70"
          >
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Proposal
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Existing Proposals{seasonYear != null ? ` • ${seasonYear + 1} Season` : ''}
        </h3>
        {actionStatus && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{actionStatus}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading proposals...</span>
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
          No proposals have been created for this season yet.
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map(proposal => {
            if (editingId === proposal.id) {
              return (
                <div key={proposal.id} className="rounded-lg border border-blue-200 bg-blue-50 p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-base font-semibold text-blue-900">Editing {proposal.title}</h4>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="inline-flex items-center rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      <X className="mr-1 h-3 w-3" /> Cancel
                    </button>
                  </div>
                  {editError && (
                    <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {editError}
                    </div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-blue-900">
                        Season Year
                      </label>
                      <input
                        type="number"
                        value={editForm.seasonYear ?? ''}
                        onChange={event => setEditForm({ ...editForm, seasonYear: event.target.value })}
                        className="mt-1 w-full rounded-md border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-blue-900">Title</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={event => setEditForm({ ...editForm, title: event.target.value })}
                        className="mt-1 w-full rounded-md border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-blue-900">Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={event => setEditForm({ ...editForm, description: event.target.value })}
                        className="mt-1 w-full rounded-md border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-blue-900">
                        Voting Options
                      </label>
                      <textarea
                        value={editForm.options}
                        onChange={event => setEditForm({ ...editForm, options: event.target.value })}
                        className="mt-1 w-full rounded-md border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={isSavingEdit}
                        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
                      >
                        {isSavingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="inline-flex items-center rounded-md border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const totalVotes = proposal.options.reduce((sum, option) => sum + (option.votes || 0), 0);

            return (
              <div key={proposal.id} className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">{proposal.title}</h4>
                    <p className="text-xs text-gray-500">
                      Season: {proposal.seasonYear} ({proposal.seasonYear + 1} Season)
                    </p>
                    {proposal.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{proposal.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(proposal)}
                      className="inline-flex items-center rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      <Edit3 className="mr-1 h-4 w-4" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProposal(proposal.id)}
                      disabled={deletingId === proposal.id}
                      className="inline-flex items-center rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {deletingId === proposal.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 h-4 w-4" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  {proposal.options.map(option => (
                    <div key={`${proposal.id}-${option.value}`} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                      <span>{option.value}</span>
                      <span className="text-xs text-gray-500">
                        {option.votes} vote{option.votes === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Total votes recorded: {totalVotes}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RuleChangeAdmin;
