import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Save, X, Trash2, Edit3, UserCheck, Undo2, Lock, Unlock } from 'lucide-react';

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
  error = null,
  managers = [],
  onCastVote,
  onClearVote,
  votingLocked = false,
  onToggleVotingLock,
  lockLoading = false,
  lockError = null
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newOptions, setNewOptions] = useState('Yes\nNo');
  const [formError, setFormError] = useState(null);
  const [formStatus, setFormStatus] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', options: '' });
  const [editingSeasonYear, setEditingSeasonYear] = useState(null);
  const [editError, setEditError] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [actionStatus, setActionStatus] = useState(null);

  const [voteManagerSelection, setVoteManagerSelection] = useState({});
  const [voteOptionSelection, setVoteOptionSelection] = useState({});
  const [votePending, setVotePending] = useState({});
  const [voteFeedback, setVoteFeedback] = useState({});

  const availableManagers = useMemo(() => {
    if (!Array.isArray(managers)) {
      return [];
    }

    return managers
      .map(manager => {
        const normalizedName =
          typeof manager?.full_name === 'string' && manager.full_name.trim()
            ? manager.full_name.trim()
            : manager?.name_id || '';
        return {
          id: manager?.name_id,
          name: normalizedName,
          active: manager?.active
        };
      })
      .filter(manager => manager.id)
      .sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
  }, [managers]);

  const hasVoteManagement =
    typeof onCastVote === 'function' &&
    typeof onClearVote === 'function' &&
    availableManagers.length > 0;

  const canCreateProposal = useMemo(() => {
    if (seasonYear == null) {
      return false;
    }

    const numeric = Number(seasonYear);
    return Number.isInteger(numeric);
  }, [seasonYear]);

  useEffect(() => {
    setVoteManagerSelection({});
    setVoteOptionSelection({});
    setVotePending({});
    setVoteFeedback({});
    setEditingId(null);
    setEditForm({ title: '', description: '', options: '' });
    setEditingSeasonYear(null);
    setEditError(null);
    setActionStatus(null);
    setFormStatus(null);
    setFormError(null);
  }, [seasonYear]);

  const getManagerVoteForProposal = (proposal, managerId) => {
    if (!proposal || !managerId) {
      return null;
    }

    for (const option of Array.isArray(proposal.options) ? proposal.options : []) {
      if (Array.isArray(option.voters) && option.voters.some(voter => voter.id === managerId)) {
        return option.value;
      }
    }

    return null;
  };

  const setProposalFeedback = (proposalId, feedback) => {
    setVoteFeedback(prev => {
      const next = { ...prev };
      if (feedback) {
        next[proposalId] = feedback;
      } else {
        delete next[proposalId];
      }
      return next;
    });
  };

  const setProposalPending = (proposalId, pending) => {
    setVotePending(prev => {
      const next = { ...prev };
      if (pending) {
        next[proposalId] = true;
      } else {
        delete next[proposalId];
      }
      return next;
    });
  };

  const handleManagerSelectionChange = (proposal, managerId) => {
    if (!proposal) {
      return;
    }

    setVoteManagerSelection(prev => {
      const next = { ...prev };
      if (managerId) {
        next[proposal.id] = managerId;
      } else {
        delete next[proposal.id];
      }
      return next;
    });

    if (managerId) {
      const currentVote = getManagerVoteForProposal(proposal, managerId);
      setVoteOptionSelection(prev => ({
        ...prev,
        [proposal.id]: currentVote ?? ''
      }));
    } else {
      setVoteOptionSelection(prev => {
        const next = { ...prev };
        delete next[proposal.id];
        return next;
      });
    }

    setProposalFeedback(proposal.id, null);
  };

  const handleOptionSelectionChange = (proposalId, optionValue) => {
    setVoteOptionSelection(prev => ({
      ...prev,
      [proposalId]: optionValue
    }));
    setProposalFeedback(proposalId, null);
  };

  const handleCastVote = async (proposal) => {
    if (!hasVoteManagement || typeof onCastVote !== 'function' || !proposal) {
      return;
    }

    const managerId = voteManagerSelection[proposal.id];
    const hasCustomSelection = Object.prototype.hasOwnProperty.call(
      voteOptionSelection,
      proposal.id
    );
    const selectedOption = hasCustomSelection
      ? voteOptionSelection[proposal.id]
      : getManagerVoteForProposal(proposal, managerId) ?? '';

    if (!managerId) {
      setProposalFeedback(proposal.id, {
        type: 'error',
        message: 'Select a manager to record a vote.'
      });
      return;
    }

    if (!selectedOption) {
      setProposalFeedback(proposal.id, {
        type: 'error',
        message: 'Select a vote option before recording.'
      });
      return;
    }

    setProposalFeedback(proposal.id, null);
    setProposalPending(proposal.id, true);

    try {
      const updatedProposal = await onCastVote(proposal.id, managerId, selectedOption);
      setProposalFeedback(proposal.id, {
        type: 'success',
        message: 'Vote recorded successfully.'
      });

      if (updatedProposal) {
        const currentVote = getManagerVoteForProposal(updatedProposal, managerId) ?? selectedOption;
        setVoteOptionSelection(prev => ({
          ...prev,
          [proposal.id]: currentVote
        }));
      } else {
        setVoteOptionSelection(prev => ({
          ...prev,
          [proposal.id]: selectedOption
        }));
      }
    } catch (err) {
      setProposalFeedback(proposal.id, {
        type: 'error',
        message: err?.message || 'Unable to record vote.'
      });
    } finally {
      setProposalPending(proposal.id, false);
    }
  };

  const handleClearVote = async (proposal) => {
    if (!hasVoteManagement || typeof onClearVote !== 'function' || !proposal) {
      return;
    }

    const managerId = voteManagerSelection[proposal.id];

    if (!managerId) {
      setProposalFeedback(proposal.id, {
        type: 'error',
        message: 'Select a manager to clear their vote.'
      });
      return;
    }

    setProposalFeedback(proposal.id, null);
    setProposalPending(proposal.id, true);

    try {
      const updatedProposal = await onClearVote(proposal.id, managerId);
      const currentVote = updatedProposal
        ? getManagerVoteForProposal(updatedProposal, managerId)
        : null;

      if (currentVote) {
        setVoteOptionSelection(prev => ({
          ...prev,
          [proposal.id]: currentVote
        }));
        setProposalFeedback(proposal.id, {
          type: 'success',
          message: 'Vote updated.'
        });
      } else {
        setVoteOptionSelection(prev => ({
          ...prev,
          [proposal.id]: ''
        }));
        setProposalFeedback(proposal.id, {
          type: 'success',
          message: 'Vote cleared.'
        });
      }
    } catch (err) {
      setProposalFeedback(proposal.id, {
        type: 'error',
        message: err?.message || 'Unable to clear vote.'
      });
    } finally {
      setProposalPending(proposal.id, false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError(null);
    setFormStatus(null);

    const parsedOptions = toUniqueOptions(newOptions);
    if (parsedOptions.length < 2) {
      setFormError('Please provide at least two unique options.');
      return;
    }

    const numericYear = Number(seasonYear);
    if (!Number.isInteger(numericYear)) {
      setFormError('Select a valid season before creating proposals.');
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
      options: proposal.options.map(option => option.value).join('\n')
    });
    setEditingSeasonYear(proposal.seasonYear);
    setEditError(null);
    setActionStatus(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ title: '', description: '', options: '' });
    setEditingSeasonYear(null);
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

    const numericYear = Number(editingSeasonYear ?? seasonYear);
    if (!Number.isInteger(numericYear)) {
      setEditError('Select a valid season before saving changes.');
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

  const hasSelectedSeason = Number.isInteger(Number(seasonYear));
  const lockSeasonLabel = hasSelectedSeason ? `${Number(seasonYear) + 1} season` : 'selected season';

  return (
    <div className="space-y-6">
      {hasSelectedSeason && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            {votingLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            <span>
              Voting for the {lockSeasonLabel} is currently{' '}
              <span className="font-semibold">{votingLocked ? 'locked' : 'open'}</span>.
            </span>
          </div>
          {typeof onToggleVotingLock === 'function' && (
            <button
              type="button"
              onClick={() => onToggleVotingLock(!votingLocked)}
              disabled={lockLoading}
              className={`mt-3 inline-flex items-center rounded-md px-3 py-1 text-sm font-medium text-white shadow-sm transition-colors sm:mt-0 ${
                votingLocked ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {lockLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                </>
              ) : votingLocked ? (
                <>
                  <Unlock className="mr-2 h-4 w-4" /> Unlock voting
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" /> Lock voting
                </>
              )}
            </button>
          )}
        </div>
      )}

      {lockError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{lockError}</div>
      )}

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Plus className="mr-2 h-5 w-5 text-blue-500" /> Create a New Proposal
          </h3>
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
            disabled={isCreating || !canCreateProposal}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-70"
          >
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Proposal
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Existing Proposals</h3>
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
            const selectedManagerId = voteManagerSelection[proposal.id] || '';
            const managerHasSelection = Boolean(selectedManagerId);
            const hasCustomSelection = Object.prototype.hasOwnProperty.call(
              voteOptionSelection,
              proposal.id
            );
            const currentVote = managerHasSelection
              ? getManagerVoteForProposal(proposal, selectedManagerId)
              : null;
            const selectedOptionValue = managerHasSelection
              ? hasCustomSelection
                ? voteOptionSelection[proposal.id]
                : currentVote ?? ''
              : '';
            const pending = !!votePending[proposal.id];
            const feedback = voteFeedback[proposal.id];
            const managerMeta = managerHasSelection
              ? availableManagers.find(manager => manager.id === selectedManagerId)
              : null;

            return (
              <div key={proposal.id} className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">{proposal.title}</h4>
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
                {hasVoteManagement && (
                  <div className="mt-4 rounded-md border border-blue-200 bg-blue-50/70 p-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-blue-900 mb-3">
                      Manage Votes
                    </h5>
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-blue-900">
                          Manager
                        </label>
                        <select
                          value={selectedManagerId}
                          onChange={event => handleManagerSelectionChange(proposal, event.target.value)}
                          className="mt-1 w-full rounded-md border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          <option value="">Select a manager</option>
                          {availableManagers.map(manager => (
                            <option key={`${proposal.id}-${manager.id}`} value={manager.id}>
                              {manager.name}
                              {manager.active === 0 ? ' (Inactive)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-blue-900">
                          Vote Option
                        </label>
                        <select
                          value={selectedOptionValue}
                          onChange={event => handleOptionSelectionChange(proposal.id, event.target.value)}
                          disabled={!managerHasSelection}
                          className="mt-1 w-full rounded-md border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-blue-50 disabled:text-blue-300"
                        >
                          <option value="">Select an option</option>
                          {proposal.options.map(option => (
                            <option key={`${proposal.id}-option-${option.value}`} value={option.value}>
                              {option.value}
                            </option>
                          ))}
                        </select>
                        {managerHasSelection && (
                          <p className="mt-1 text-xs text-blue-700">
                            Current vote:{' '}
                            {currentVote ? <span className="font-medium">{currentVote}</span> : 'No vote recorded'}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col justify-end gap-2 sm:flex-row lg:flex-col lg:items-end">
                        <button
                          type="button"
                          onClick={() => handleCastVote(proposal)}
                          disabled={!managerHasSelection || !selectedOptionValue || pending}
                          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <UserCheck className="mr-2 h-4 w-4" />
                          )}
                          {pending ? 'Saving...' : 'Record Vote'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearVote(proposal)}
                          disabled={!managerHasSelection || pending}
                          className="inline-flex items-center justify-center rounded-md border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Undo2 className="mr-2 h-4 w-4" />
                          Clear Vote
                        </button>
                      </div>
                    </div>
                    {feedback && (
                      <div
                        className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                          feedback.type === 'success'
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {feedback.message}
                        {feedback.type === 'success' && managerMeta && (
                          <span className="ml-1 font-medium">
                            ({managerMeta.name})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
