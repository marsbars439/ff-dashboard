import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useManagerAuth } from './ManagerAuthContext';
import { useAdminSession } from './AdminSessionContext';
import { useKeeperTools } from './KeeperToolsContext';

const DEFAULT_API_BASE_URL = process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api');

const parseJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('Unable to parse JSON response:', error);
    return {};
  }
};

const RuleVotingContext = createContext(null);
export const RuleVotingProvider = ({ children, apiBaseUrl = DEFAULT_API_BASE_URL }) => {
  const { managerAuth, clearManagerAuth } = useManagerAuth();
  const { adminSession, invalidateAdminSession } = useAdminSession();
  const { selectedKeeperYear } = useKeeperTools();

  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userVotes, setUserVotes] = useState({});
  const [voteStatus, setVoteStatus] = useState({});
  const [votingLocked, setVotingLocked] = useState(false);
  const [lockError, setLockError] = useState(null);
  const [lockUpdating, setLockUpdating] = useState(false);

  const resetRuleVotingState = useCallback((message = null, { resetVotingLocks = false } = {}) => {
    setProposals([]);
    setUserVotes({});
    setVoteStatus({});

    if (typeof message === 'string') {
      setError(message);
    } else {
      setError(null);
    }

    if (resetVotingLocks) {
      setVotingLocked(false);
      setLockError(null);
    }
  }, []);

  const clearManagerVotingState = useCallback((message, options = {}) => {
    clearManagerAuth(message);
    resetRuleVotingState(message, options);
  }, [clearManagerAuth, resetRuleVotingState]);
  const fetchRuleChangeProposals = useCallback(async (year, { silent = false } = {}) => {
    if (!year) {
      if (!silent) {
        setProposals([]);
        setUserVotes({});
      }
      setVotingLocked(false);
      setLockError(null);
      return null;
    }

    const hasManagerAuth =
      managerAuth.status === 'authenticated' &&
      Boolean(managerAuth.managerId) &&
      Boolean(managerAuth.token);

    const hasAdminAuth =
      adminSession.status === 'authorized' && Boolean(adminSession.token);

    if (!hasManagerAuth && !hasAdminAuth) {
      if (!silent) {
        setProposals([]);
        setUserVotes({});
        setError('Please verify your manager identity to view proposals.');
      }
      setVotingLocked(false);
      return null;
    }

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({ season_year: year.toString() });
      const headers = {};

      if (hasManagerAuth) {
        headers['X-Manager-Id'] = managerAuth.managerId;
        headers['X-Manager-Token'] = managerAuth.token;
      } else if (hasAdminAuth) {
        headers['X-Admin-Token'] = adminSession.token;
      }

      const response = await fetch(`${apiBaseUrl}/rule-changes?${params.toString()}`, {
        headers
      });

      const data = await parseJsonResponse(response);

      if (response.status === 401) {
        if (hasManagerAuth) {
          clearManagerVotingState('Your manager session has expired. Please sign in again.');
        } else if (hasAdminAuth) {
          invalidateAdminSession();
        }
        throw new Error(data?.error || 'Authentication required to access rule change proposals.');
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch rule change proposals');
      }

      const proposalsData = Array.isArray(data.proposals) ? data.proposals : [];
      setProposals(proposalsData);
      const voteMap = proposalsData.reduce((acc, proposal) => {
        if (proposal && proposal.userVote) {
          acc[proposal.id] = proposal.userVote;
        }
        return acc;
      }, {});
      setUserVotes(voteMap);
      const votingLockedResponse = Boolean(data?.votingLocked);
      setVotingLocked(votingLockedResponse);
      setLockError(null);
      return { proposals: proposalsData, votingLocked: votingLockedResponse };
    } catch (fetchError) {
      console.error('Error fetching rule change proposals:', fetchError);
      setError(fetchError.message || 'Failed to load rule change proposals');
      if (!silent) {
        setProposals([]);
        setUserVotes({});
      }
      setVotingLocked(false);
      return null;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [
    adminSession.status,
    adminSession.token,
    apiBaseUrl,
    clearManagerVotingState,
    invalidateAdminSession,
    managerAuth.managerId,
    managerAuth.status,
    managerAuth.token
  ]);
  useEffect(() => {
    if (!selectedKeeperYear) {
      resetRuleVotingState(null, { resetVotingLocks: true });
      return;
    }

    const hasManagerAuth = managerAuth.status === 'authenticated';
    const hasAdminAuth = adminSession.status === 'authorized';

    if (hasManagerAuth || hasAdminAuth) {
      fetchRuleChangeProposals(selectedKeeperYear);
    } else if (managerAuth.status === 'unauthenticated' && !hasAdminAuth) {
      resetRuleVotingState();
      setVotingLocked(false);
    }
  }, [
    adminSession.status,
    fetchRuleChangeProposals,
    managerAuth.status,
    resetRuleVotingState,
    selectedKeeperYear
  ]);

  useEffect(() => {
    setLockError(null);
  }, [selectedKeeperYear]);
  const handleRuleChangeVote = useCallback(async (proposalId, optionValue) => {
    const trimmedOption = typeof optionValue === 'string' ? optionValue.trim() : '';
    const isClearingVote = !trimmedOption;

    if (managerAuth.status !== 'authenticated') {
      setError('Please verify your manager identity to vote.');
      return;
    }

    if (!proposalId) {
      return;
    }

    setError(null);
    setVoteStatus(prev => ({ ...prev, [proposalId]: true }));

    try {
      const response = await fetch(`${apiBaseUrl}/rule-changes/${proposalId}/vote`, {
        method: isClearingVote ? 'DELETE' : 'POST',
        headers: {
          ...(isClearingVote ? {} : { 'Content-Type': 'application/json' }),
          'X-Manager-Id': managerAuth.managerId,
          'X-Manager-Token': managerAuth.token
        },
        ...(isClearingVote ? {} : { body: JSON.stringify({ option: trimmedOption }) })
      });

      const data = await parseJsonResponse(response);

      if (response.status === 401) {
        clearManagerVotingState('Your manager session has expired. Please sign in again.');
        throw new Error(data?.error || 'Authentication required to record vote.');
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to record vote');
      }

      if (data?.proposal) {
        setProposals(prev =>
          prev.map(proposal => (proposal.id === proposalId ? data.proposal : proposal))
        );

        setUserVotes(prev => {
          const next = { ...prev };
          if (data.proposal.userVote) {
            next[proposalId] = data.proposal.userVote;
          } else {
            delete next[proposalId];
          }
          return next;
        });
      }
    } catch (voteError) {
      console.error('Error submitting rule change vote:', voteError);
      setError(voteError.message || 'Failed to submit vote');
    } finally {
      setVoteStatus(prev => {
        const { [proposalId]: _ignored, ...rest } = prev;
        return rest;
      });
    }
  }, [apiBaseUrl, clearManagerVotingState, managerAuth.managerId, managerAuth.status, managerAuth.token]);
  const createRuleChangeProposal = useCallback(async ({ seasonYear, title, description, options }) => {
    setError(null);
    const payload = {
      seasonYear,
      title,
      description: description || '',
      options
    };

    const response = await fetch(`${apiBaseUrl}/rule-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to create rule change proposal');
    }

    if (selectedKeeperYear && Number(seasonYear) === Number(selectedKeeperYear)) {
      await fetchRuleChangeProposals(selectedKeeperYear);
    }

    return data?.proposal || null;
  }, [apiBaseUrl, fetchRuleChangeProposals, selectedKeeperYear]);

  const updateRuleChangeProposal = useCallback(async (proposalId, { seasonYear, title, description, options }) => {
    setError(null);
    const response = await fetch(`${apiBaseUrl}/rule-changes/${proposalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonYear, title, description: description || '', options })
    });

    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to update rule change proposal');
    }

    if (selectedKeeperYear) {
      await fetchRuleChangeProposals(selectedKeeperYear);
    }

    return data?.proposal || null;
  }, [apiBaseUrl, fetchRuleChangeProposals, selectedKeeperYear]);

  const deleteRuleChangeProposal = useCallback(async (proposalId) => {
    setError(null);
    const response = await fetch(`${apiBaseUrl}/rule-changes/${proposalId}`, {
      method: 'DELETE'
    });

    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to delete rule change proposal');
    }

    if (selectedKeeperYear) {
      await fetchRuleChangeProposals(selectedKeeperYear);
    }
  }, [apiBaseUrl, fetchRuleChangeProposals, selectedKeeperYear]);
  const reorderRuleChangeProposals = useCallback(async (seasonYear, orderedProposalIds) => {
    if (adminSession.status !== 'authorized' || !adminSession.token) {
      throw new Error('Admin authentication is required to reorder proposals.');
    }

    const numericYear = Number(seasonYear);

    if (!Number.isInteger(numericYear)) {
      throw new Error('Select a season before reordering proposals.');
    }

    if (!Array.isArray(orderedProposalIds) || orderedProposalIds.length === 0) {
      throw new Error('Provide the complete proposal order before saving.');
    }

    const normalizedIds = orderedProposalIds.map(id => Number(id));

    if (!normalizedIds.every(id => Number.isInteger(id))) {
      throw new Error('Proposal identifiers must be valid integers.');
    }

    const uniqueIds = new Set(normalizedIds);

    if (uniqueIds.size !== normalizedIds.length) {
      throw new Error('Each proposal must be included exactly once when reordering.');
    }

    if (Array.isArray(proposals) && uniqueIds.size !== proposals.length) {
      throw new Error('Each proposal must be included exactly once when reordering.');
    }

    setError(null);

    const response = await fetch(`${apiBaseUrl}/rule-changes/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminSession.token
      },
      body: JSON.stringify({ seasonYear: numericYear, orderedIds: normalizedIds })
    });

    const data = await parseJsonResponse(response);

    if (response.status === 401) {
      invalidateAdminSession();
      throw new Error(data?.error || 'Admin session has expired. Please sign in again.');
    }

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to reorder proposals');
    }

    if (Array.isArray(data?.proposals)) {
      setProposals(data.proposals);
    } else if (selectedKeeperYear) {
      await fetchRuleChangeProposals(selectedKeeperYear);
    }

    return data?.proposals || [];
  }, [
    adminSession.status,
    adminSession.token,
    apiBaseUrl,
    fetchRuleChangeProposals,
    invalidateAdminSession,
    proposals,
    selectedKeeperYear
  ]);
  const adminCastRuleChangeVote = useCallback(async (proposalId, managerId, optionValue) => {
    const normalizedProposalId = Number(proposalId);
    const normalizedManagerId = typeof managerId === 'string' ? managerId.trim() : '';
    const normalizedOption = typeof optionValue === 'string' ? optionValue.trim() : '';

    if (!Number.isInteger(normalizedProposalId)) {
      throw new Error('A valid proposal identifier is required.');
    }

    if (!normalizedManagerId) {
      throw new Error('Select a manager to record a vote.');
    }

    if (!normalizedOption) {
      throw new Error('Select a vote option before recording.');
    }

    if (adminSession.status !== 'authorized' || !adminSession.token) {
      throw new Error('Admin authentication is required to record votes.');
    }

    setError(null);

    const response = await fetch(`${apiBaseUrl}/rule-changes/${normalizedProposalId}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminSession.token
      },
      body: JSON.stringify({ option: normalizedOption, managerId: normalizedManagerId })
    });

    const data = await parseJsonResponse(response);

    if (response.status === 401) {
      invalidateAdminSession();
      throw new Error(data?.error || 'Admin session has expired. Please sign in again.');
    }

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to record vote');
    }

    if (data?.proposal) {
      setProposals(prev =>
        Array.isArray(prev)
          ? prev.map(existing => (existing.id === data.proposal.id ? data.proposal : existing))
          : []
      );
    }

    return data?.proposal || null;
  }, [adminSession.status, adminSession.token, apiBaseUrl, invalidateAdminSession]);

  const adminClearRuleChangeVote = useCallback(async (proposalId, managerId) => {
    const normalizedProposalId = Number(proposalId);
    const normalizedManagerId = typeof managerId === 'string' ? managerId.trim() : '';

    if (!Number.isInteger(normalizedProposalId)) {
      throw new Error('A valid proposal identifier is required.');
    }

    if (!normalizedManagerId) {
      throw new Error('Select a manager to clear their vote.');
    }

    if (adminSession.status !== 'authorized' || !adminSession.token) {
      throw new Error('Admin authentication is required to clear votes.');
    }

    setError(null);

    const response = await fetch(`${apiBaseUrl}/rule-changes/${normalizedProposalId}/vote`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminSession.token
      },
      body: JSON.stringify({ managerId: normalizedManagerId })
    });

    const data = await parseJsonResponse(response);

    if (response.status === 401) {
      invalidateAdminSession();
      throw new Error(data?.error || 'Admin session has expired. Please sign in again.');
    }

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to clear vote');
    }

    if (data?.proposal) {
      setProposals(prev =>
        Array.isArray(prev)
          ? prev.map(existing => (existing.id === data.proposal.id ? data.proposal : existing))
          : []
      );
    }

    return data?.proposal || null;
  }, [adminSession.status, adminSession.token, apiBaseUrl, invalidateAdminSession]);
  const toggleRuleChangeVotingLock = useCallback(async (desiredLocked) => {
    if (lockUpdating) {
      return;
    }

    const seasonYear = selectedKeeperYear;
    if (!seasonYear) {
      throw new Error('Select a season before updating voting.');
    }

    if (adminSession.status !== 'authorized' || !adminSession.token) {
      throw new Error('Admin authentication is required to update voting access.');
    }

    setLockUpdating(true);

    try {
      const numericYear = Number(seasonYear);
      const response = await fetch(`${apiBaseUrl}/rule-changes/voting-lock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminSession.token
        },
        body: JSON.stringify({ seasonYear: numericYear, locked: desiredLocked })
      });

      const data = await parseJsonResponse(response);

      if (response.status === 401) {
        invalidateAdminSession();
        throw new Error(data?.error || 'Admin session has expired. Please sign in again.');
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update voting lock');
      }

      const locked = Boolean(data?.locked);
      setVotingLocked(locked);
      setLockError(null);
      await fetchRuleChangeProposals(numericYear, { silent: true });
    } catch (lockUpdateError) {
      console.error('Error updating voting lock:', lockUpdateError);
      setLockError(lockUpdateError.message || 'Failed to update voting lock');
    } finally {
      setLockUpdating(false);
    }
  }, [
    adminSession.status,
    adminSession.token,
    apiBaseUrl,
    fetchRuleChangeProposals,
    invalidateAdminSession,
    lockUpdating,
    selectedKeeperYear
  ]);
  const handleManagerLogout = useCallback(() => {
    clearManagerVotingState('Please verify your manager identity to view proposals.', {
      resetVotingLocks: true
    });
  }, [clearManagerVotingState]);

  const handleVotingLockChange = useCallback((year) => {
    const numericYear = Number(year);
    if (!Number.isInteger(numericYear)) {
      return;
    }

    if (Number(selectedKeeperYear) === numericYear) {
      fetchRuleChangeProposals(numericYear, { silent: true });
    }
  }, [fetchRuleChangeProposals, selectedKeeperYear]);

  const value = useMemo(() => ({
    apiBaseUrl,
    seasonYear: selectedKeeperYear,
    proposals,
    loading,
    error,
    userVotes,
    voteStatus,
    votingLocked,
    lockError,
    lockUpdating,
    handleRuleChangeVote,
    createRuleChangeProposal,
    updateRuleChangeProposal,
    deleteRuleChangeProposal,
    reorderRuleChangeProposals,
    adminCastRuleChangeVote,
    adminClearRuleChangeVote,
    toggleRuleChangeVotingLock,
    handleManagerLogout,
    handleVotingLockChange,
    refreshRuleChangeProposals: fetchRuleChangeProposals
  }), [
    adminCastRuleChangeVote,
    adminClearRuleChangeVote,
    apiBaseUrl,
    createRuleChangeProposal,
    deleteRuleChangeProposal,
    error,
    fetchRuleChangeProposals,
    handleRuleChangeVote,
    handleManagerLogout,
    handleVotingLockChange,
    loading,
    lockError,
    lockUpdating,
    proposals,
    reorderRuleChangeProposals,
    selectedKeeperYear,
    toggleRuleChangeVotingLock,
    updateRuleChangeProposal,
    userVotes,
    voteStatus,
    votingLocked
  ]);

  return (
    <RuleVotingContext.Provider value={value}>
      {children}
    </RuleVotingContext.Provider>
  );
};

export const useRuleVoting = () => {
  const context = useContext(RuleVotingContext);
  if (!context) {
    throw new Error('useRuleVoting must be used within a RuleVotingProvider');
  }
  return context;
};
