const express = require('express');

const sanitizeRuleChangeOptions = (rawOptions) => {
  if (Array.isArray(rawOptions)) {
    return Array.from(
      new Set(
        rawOptions
          .map(option => (typeof option === 'string' ? option.trim() : ''))
          .filter(option => option.length > 0)
      )
    );
  }

  if (typeof rawOptions === 'string') {
    return sanitizeRuleChangeOptions(rawOptions.split('\n'));
  }

  return [];
};

const parseRuleChangeOptions = (options) => {
  if (!options) {
    return [];
  }

  if (Array.isArray(options)) {
    return sanitizeRuleChangeOptions(options);
  }

  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) {
        return sanitizeRuleChangeOptions(parsed);
      }
    } catch (error) {
      console.warn('Unable to parse rule change options JSON, falling back to newline parsing.');
    }

    return sanitizeRuleChangeOptions(options.split('\n'));
  }

  return [];
};

const mapManagersToSummaries = (rows = []) =>
  rows.map(row => ({
    id: row.name_id,
    name:
      typeof row.full_name === 'string' && row.full_name.trim()
        ? row.full_name.trim()
        : row.name_id
  }));

const validateProposalReorderPayload = (existingIds = [], incomingIds = []) => {
  if (!existingIds.length) {
    return {
      valid: false,
      error: 'No proposals exist for the provided seasonYear',
      status: 404
    };
  }

  const uniqueIncomingIds = new Set(incomingIds);
  if (uniqueIncomingIds.size !== incomingIds.length) {
    return { valid: false, error: 'proposalIds/orderedIds must not contain duplicate ids' };
  }

  const existingIdSet = new Set(existingIds);
  const invalidIds = incomingIds.filter(id => !existingIdSet.has(id));
  if (invalidIds.length) {
    return {
      valid: false,
      error: 'proposalIds/orderedIds must only reference proposals from the provided seasonYear'
    };
  }

  if (incomingIds.length !== existingIds.length) {
    return {
      valid: false,
      error: 'proposalIds/orderedIds must include every proposal exactly once'
    };
  }

  const missingIds = existingIds.filter(id => !uniqueIncomingIds.has(id));
  if (missingIds.length) {
    return {
      valid: false,
      error: 'proposalIds/orderedIds must include every proposal exactly once'
    };
  }

  return { valid: true };
};

const buildProposalVoteDetails = (rows = []) =>
  rows.reduce((acc, row) => {
    if (!acc[row.proposal_id]) {
      acc[row.proposal_id] = { optionMap: {}, voterIds: new Set() };
    }

    const detail = acc[row.proposal_id];
    if (!detail.optionMap[row.option]) {
      detail.optionMap[row.option] = [];
    }

    const normalizedName =
      typeof row.full_name === 'string' && row.full_name.trim()
        ? row.full_name.trim()
        : row.voter_id;

    detail.optionMap[row.option].push({
      id: row.voter_id,
      name: normalizedName
    });
    detail.voterIds.add(row.voter_id);
    return acc;
  }, {});

const formatRuleChangeProposal = (
  row,
  voteDetailIndex = {},
  userVoteIndex = {},
  activeManagers = []
) => {
  const options = parseRuleChangeOptions(row.options);
  const proposalDetails = voteDetailIndex[row.id] || { optionMap: {}, voterIds: new Set() };
  const voterIds = proposalDetails.voterIds instanceof Set ? proposalDetails.voterIds : new Set();
  const optionMap = proposalDetails.optionMap || {};

  const nonVoters = activeManagers
    .filter(manager => !voterIds.has(manager.id))
    .map(manager => ({ id: manager.id, name: manager.name }));

  return {
    id: row.id,
    seasonYear: row.season_year,
    title: row.title,
    description: row.description || '',
    displayOrder:
      typeof row.display_order === 'number'
        ? row.display_order
        : row.display_order != null
          ? Number(row.display_order)
          : null,
    options: options.map(optionValue => ({
      value: optionValue,
      votes: Array.isArray(optionMap[optionValue]) ? optionMap[optionValue].length : 0,
      voters: Array.isArray(optionMap[optionValue])
        ? optionMap[optionValue]
            .slice()
            .sort((a, b) =>
              (a.name || a.id || '').localeCompare(b.name || b.id || '', undefined, {
                sensitivity: 'base'
              })
            )
        : []
    })),
    userVote: userVoteIndex[row.id] || null,
    nonVoters,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

function createRulesRouter({
  getAsync,
  runAsync,
  allAsync,
  isAdminTokenValid,
  requireManagerAuth,
  parseBooleanFlag
} = {}) {
  if (!getAsync || !runAsync || !allAsync) {
    throw new Error('Database helpers are required to configure the rules router');
  }

  if (typeof isAdminTokenValid !== 'function') {
    throw new Error('Admin token validator is required');
  }

  const router = express.Router();

  const getRuleChangeVotingLockRow = async (seasonYear) =>
    getAsync('SELECT season_year, locked, locked_at, updated_at FROM rule_change_voting_locks WHERE season_year = ?', [
      seasonYear
    ]);

  const isRuleChangeVotingLocked = async (seasonYear) => {
    if (!Number.isInteger(seasonYear)) {
      return false;
    }

    const row = await getRuleChangeVotingLockRow(seasonYear);
    return row ? row.locked === 1 : false;
  };

  const setRuleChangeVotingLock = async (seasonYear, locked) =>
    runAsync(
      `INSERT INTO rule_change_voting_locks (season_year, locked, locked_at, updated_at)
       VALUES (?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
       ON CONFLICT(season_year) DO UPDATE SET
         locked = excluded.locked,
         locked_at = CASE WHEN excluded.locked = 1 THEN CURRENT_TIMESTAMP ELSE locked_at END,
         updated_at = CURRENT_TIMESTAMP`,
      [seasonYear, locked ? 1 : 0, locked ? 1 : 0]
    ).then(() => getRuleChangeVotingLockRow(seasonYear));

  const getRuleChangeProposalsForYear = async (seasonYear, managerId = null) => {
    const proposals = await allAsync(
      `SELECT *
       FROM rule_change_proposals
       WHERE season_year = ?
       ORDER BY display_order ASC, created_at DESC`,
      [seasonYear]
    );

    if (!proposals.length) {
      return [];
    }

    const proposalIds = proposals.map(proposal => proposal.id);
    const placeholders = proposalIds.map(() => '?').join(',');

    const voteRows = await allAsync(
      `SELECT v.proposal_id, v.option, v.voter_id, m.full_name
       FROM rule_change_votes v
       LEFT JOIN managers m ON v.voter_id = m.name_id
       WHERE v.proposal_id IN (${placeholders})`,
      proposalIds
    );

    const voteDetailIndex = buildProposalVoteDetails(voteRows);
    const userVoteRows = managerId
      ? await allAsync(
          `SELECT proposal_id, option
           FROM rule_change_votes
           WHERE proposal_id IN (${placeholders}) AND voter_id = ?`,
          [...proposalIds, managerId]
        )
      : [];
    const userVoteIndex = userVoteRows.reduce((acc, row) => {
      acc[row.proposal_id] = row.option;
      return acc;
    }, {});

    const activeManagerRows = await allAsync(
      'SELECT name_id, full_name FROM managers WHERE active = 1 ORDER BY full_name'
    );

    return proposals.map(proposal =>
      formatRuleChangeProposal(
        proposal,
        voteDetailIndex,
        userVoteIndex,
        mapManagersToSummaries(activeManagerRows)
      )
    );
  };

  router.get('/rule-changes', async (req, res) => {
    const seasonYear = parseInt(req.query.season_year, 10);

    if (Number.isNaN(seasonYear)) {
      return res.status(400).json({ error: 'season_year is required' });
    }

    const adminTokenHeader = req.headers['x-admin-token'];
    const adminToken = typeof adminTokenHeader === 'string' ? adminTokenHeader.trim() : '';
    const adminAuthorized = adminToken ? isAdminTokenValid(adminToken) : false;

    if (adminToken && !adminAuthorized) {
      return res.status(401).json({ error: 'Invalid or expired admin token' });
    }

    try {
      let managerId = null;

      if (!adminAuthorized) {
        const manager = await requireManagerAuth(req, res);
        if (!manager) {
          return;
        }
        managerId = manager.name_id;
      }

      const [proposals, votingLockedRow] = await Promise.all([
        getRuleChangeProposalsForYear(seasonYear, managerId),
        getRuleChangeVotingLockRow(seasonYear)
      ]);

      res.json({
        proposals,
        votingLocked: votingLockedRow ? votingLockedRow.locked === 1 : false
      });
    } catch (error) {
      console.error('Error fetching rule change proposals:', error);
      res.status(500).json({ error: 'Failed to fetch rule change proposals' });
    }
  });

  router.post('/rule-changes', async (req, res) => {
    const { seasonYear, title, description = '', options } = req.body || {};
    const numericYear = parseInt(seasonYear, 10);

    if (Number.isNaN(numericYear)) {
      return res.status(400).json({ error: 'A valid seasonYear is required' });
    }

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const normalizedOptions = sanitizeRuleChangeOptions(options);

    if (normalizedOptions.length < 2) {
      return res.status(400).json({ error: 'At least two options are required' });
    }

    try {
      const row = await getAsync(
        'SELECT MAX(display_order) AS maxOrder FROM rule_change_proposals WHERE season_year = ?',
        [numericYear]
      );
      const maxOrder = typeof row?.maxOrder === 'number' ? row.maxOrder : parseInt(row?.maxOrder, 10);
      const normalizedMax = Number.isFinite(maxOrder) ? maxOrder : 0;
      const nextDisplayOrder = normalizedMax + 1;

      const result = await runAsync(
        `INSERT INTO rule_change_proposals (season_year, title, description, options, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          numericYear,
          title.trim(),
          typeof description === 'string' ? description.trim() : '',
          JSON.stringify(normalizedOptions),
          nextDisplayOrder
        ]
      );

      const newRow = await getAsync('SELECT * FROM rule_change_proposals WHERE id = ?', [result.lastID]);
      const formatted = formatRuleChangeProposal(newRow, {}, {});
      res.status(201).json({ proposal: formatted });
    } catch (error) {
      console.error('Error creating rule change proposal:', error);
      res.status(500).json({ error: 'Failed to create rule change proposal' });
    }
  });

  router.put('/rule-changes/voting-lock', async (req, res) => {
    const adminTokenHeader = req.headers['x-admin-token'];
    const adminToken = typeof adminTokenHeader === 'string' ? adminTokenHeader.trim() : '';

    if (!adminToken || !isAdminTokenValid(adminToken)) {
      return res.status(401).json({ error: 'Admin authentication is required' });
    }

    const { seasonYear, locked } = req.body || {};
    const numericYear = parseInt(seasonYear, 10);

    if (Number.isNaN(numericYear)) {
      return res.status(400).json({ error: 'A valid seasonYear is required' });
    }

    const { valid, value: desiredLocked } = parseBooleanFlag(locked);

    if (!valid) {
      return res.status(400).json({ error: 'locked must be a boolean value' });
    }

    try {
      const updatedRow = await setRuleChangeVotingLock(numericYear, desiredLocked);
      res.json({
        seasonYear: updatedRow?.season_year ?? numericYear,
        locked: updatedRow ? updatedRow.locked === 1 : desiredLocked,
        lockedAt: updatedRow?.locked_at || null,
        updatedAt: updatedRow?.updated_at || null
      });
    } catch (error) {
      console.error('Error updating rule change voting lock:', error);
      res.status(500).json({ error: 'Failed to update voting lock' });
    }
  });

  router.put('/rule-changes/reorder', async (req, res) => {
    const adminTokenHeader = req.headers['x-admin-token'];
    const adminToken = typeof adminTokenHeader === 'string' ? adminTokenHeader.trim() : '';

    if (!adminToken || !isAdminTokenValid(adminToken)) {
      return res.status(401).json({ error: 'Admin authentication is required' });
    }

    const { seasonYear, proposalIds, orderedIds } = req.body || {};
    const numericYear = parseInt(seasonYear, 10);
    const sourceIds = Array.isArray(proposalIds) && proposalIds.length
      ? proposalIds
      : (Array.isArray(orderedIds) ? orderedIds : []);
    const ids = sourceIds.map(id => parseInt(id, 10)).filter(id => !Number.isNaN(id));

    if (Number.isNaN(numericYear)) {
      return res.status(400).json({ error: 'A valid seasonYear is required' });
    }

    if (!ids.length) {
      return res.status(400).json({ error: 'proposalIds/orderedIds must contain at least one id' });
    }

    let transactionStarted = false;

    try {
      const existingProposals = await allAsync(
        'SELECT id FROM rule_change_proposals WHERE season_year = ?',
        [numericYear]
      );
      const existingIds = existingProposals.map(row => row.id);
      const {
        valid,
        error: validationError,
        status: validationStatus
      } = validateProposalReorderPayload(existingIds, ids);

      if (!valid) {
        const statusCode = Number.isInteger(validationStatus) ? validationStatus : 400;
        return res.status(statusCode).json({ error: validationError });
      }

      await runAsync('BEGIN TRANSACTION');
      transactionStarted = true;
      for (let index = 0; index < ids.length; index += 1) {
        await runAsync(
          'UPDATE rule_change_proposals SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND season_year = ?',
          [index + 1, ids[index], numericYear]
        );
      }
      await runAsync('COMMIT');
      transactionStarted = false;

      const updatedProposals = await getRuleChangeProposalsForYear(numericYear);
      res.json({ proposals: updatedProposals });
    } catch (error) {
      if (transactionStarted) {
        await runAsync('ROLLBACK');
      }
      console.error('Error reordering proposals:', error);
      res.status(500).json({ error: 'Failed to reorder proposals' });
    }
  });

  router.put('/rule-changes/:id', async (req, res) => {
    const proposalId = parseInt(req.params.id, 10);

    if (Number.isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal id' });
    }

    const { seasonYear, title, description = '', options, displayOrder } = req.body || {};
    const normalizedOptions = sanitizeRuleChangeOptions(options);

    if (!title || normalizedOptions.length < 2) {
      return res.status(400).json({ error: 'Title and at least two options are required' });
    }

    const numericYear = parseInt(seasonYear, 10);

    if (Number.isNaN(numericYear)) {
      return res.status(400).json({ error: 'A valid seasonYear is required' });
    }

    try {
      const existingRow = await getAsync('SELECT * FROM rule_change_proposals WHERE id = ?', [proposalId]);
      if (!existingRow) {
        return res.status(404).json({ error: 'Proposal not found' });
      }

      const previousOptions = parseRuleChangeOptions(existingRow.options);

      let resolvedDisplayOrder = existingRow.display_order;
      if (Number.isFinite(displayOrder)) {
        resolvedDisplayOrder = displayOrder;
      } else if (typeof displayOrder === 'string' && displayOrder.trim() !== '') {
        const parsedDisplayOrder = Number.parseInt(displayOrder, 10);
        if (!Number.isNaN(parsedDisplayOrder)) {
          resolvedDisplayOrder = parsedDisplayOrder;
        }
      }

      await runAsync(
        `UPDATE rule_change_proposals
         SET season_year = ?, title = ?, description = ?, options = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          numericYear,
          title.trim(),
          typeof description === 'string' ? description.trim() : '',
          JSON.stringify(normalizedOptions),
          resolvedDisplayOrder,
          proposalId
        ]
      );

      const removedOptions = previousOptions.filter(
        option => !normalizedOptions.includes(option)
      );

      for (const removedOption of removedOptions) {
        await runAsync('DELETE FROM rule_change_votes WHERE proposal_id = ? AND option = ?', [
          proposalId,
          removedOption
        ]);
      }

      const updatedRow = await getAsync('SELECT * FROM rule_change_proposals WHERE id = ?', [proposalId]);

      const voteRows = await allAsync(
        `SELECT v.proposal_id, v.option, v.voter_id, m.full_name
         FROM rule_change_votes v
         LEFT JOIN managers m ON v.voter_id = m.name_id
         WHERE v.proposal_id = ?`,
        [proposalId]
      );
      const voteDetailIndex = buildProposalVoteDetails(voteRows);

      res.json({ proposal: formatRuleChangeProposal(updatedRow, voteDetailIndex, {}) });
    } catch (error) {
      console.error('Error updating proposal:', error);
      res.status(500).json({ error: 'Failed to update proposal' });
    }
  });

  router.delete('/rule-changes/:id', async (req, res) => {
    const proposalId = parseInt(req.params.id, 10);

    if (Number.isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal id' });
    }

    try {
      const deleteResult = await runAsync('DELETE FROM rule_change_proposals WHERE id = ?', [proposalId]);
      if (!deleteResult || deleteResult.changes === 0) {
        return res.status(404).json({ error: 'Proposal not found' });
      }

      await runAsync('DELETE FROM rule_change_votes WHERE proposal_id = ?', [proposalId]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting proposal:', error);
      res.status(500).json({ error: 'Failed to delete proposal' });
    }
  });

  router.post('/rule-changes/:id/vote', async (req, res) => {
    const proposalId = parseInt(req.params.id, 10);

    if (Number.isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal id' });
    }

    const { option } = req.body || {};
    const normalizedOption = typeof option === 'string' ? option.trim() : '';

    if (!normalizedOption) {
      return res.status(400).json({ error: 'A valid option is required' });
    }

    try {
      const adminTokenHeader = req.headers['x-admin-token'];
      const adminToken = typeof adminTokenHeader === 'string' ? adminTokenHeader.trim() : '';
      const adminAuthorized = adminToken ? isAdminTokenValid(adminToken) : false;

      if (adminToken && !adminAuthorized) {
        return res.status(401).json({ error: 'Invalid or expired admin token' });
      }

      let actingManager = null;

      if (adminAuthorized) {
        const candidateManagerIds = [
          req.body?.managerId,
          req.body?.manager_id,
          req.body?.voterId,
          req.body?.voter_id
        ];

        const normalizedManagerId = candidateManagerIds
          .map(value => (typeof value === 'string' ? value.trim() : ''))
          .find(value => value.length > 0);

        if (!normalizedManagerId) {
          return res
            .status(400)
            .json({ error: 'managerId is required when casting a vote as an admin' });
        }

        const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [
          normalizedManagerId
        ]);

        if (!managerRow) {
          return res.status(404).json({ error: 'Manager not found' });
        }

        actingManager = managerRow;
      } else {
        const manager = await requireManagerAuth(req, res);
        if (!manager) {
          return;
        }

        actingManager = manager;
      }

      const proposalRow = await getAsync('SELECT * FROM rule_change_proposals WHERE id = ?', [proposalId]);

      if (!proposalRow) {
        return res.status(404).json({ error: 'Proposal not found' });
      }

      if (!adminAuthorized) {
        const votingLocked = await isRuleChangeVotingLocked(proposalRow.season_year);
        if (votingLocked) {
          return res.status(403).json({ error: 'Voting has been locked for this season' });
        }
      }

      const availableOptions = parseRuleChangeOptions(proposalRow.options);
      if (!availableOptions.includes(normalizedOption)) {
        return res.status(400).json({ error: 'Invalid option selected' });
      }

      await runAsync(
        `INSERT INTO rule_change_votes (proposal_id, voter_id, option, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(proposal_id, voter_id) DO UPDATE SET option = excluded.option, updated_at = CURRENT_TIMESTAMP`,
        [proposalId, actingManager.name_id, normalizedOption]
      );

      const voteRows = await allAsync(
        `SELECT v.proposal_id, v.option, v.voter_id, m.full_name
         FROM rule_change_votes v
         LEFT JOIN managers m ON v.voter_id = m.name_id
         WHERE v.proposal_id = ?`,
        [proposalId]
      );
      const activeManagerRows = await allAsync(
        'SELECT name_id, full_name FROM managers WHERE active = 1 ORDER BY full_name'
      );
      const voteDetailIndex = buildProposalVoteDetails(voteRows);
      const formatted = formatRuleChangeProposal(
        proposalRow,
        voteDetailIndex,
        adminAuthorized ? {} : { [proposalId]: normalizedOption },
        mapManagersToSummaries(activeManagerRows)
      );

      res.json({ proposal: formatted });
    } catch (error) {
      console.error('Error recording rule change vote:', error);
      res.status(500).json({ error: 'Failed to record vote' });
    }
  });

  router.delete('/rule-changes/:id/vote', async (req, res) => {
    const proposalId = parseInt(req.params.id, 10);

    if (Number.isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal id' });
    }

    try {
      const adminTokenHeader = req.headers['x-admin-token'];
      const adminToken = typeof adminTokenHeader === 'string' ? adminTokenHeader.trim() : '';
      const adminAuthorized = adminToken ? isAdminTokenValid(adminToken) : false;

      if (adminToken && !adminAuthorized) {
        return res.status(401).json({ error: 'Invalid or expired admin token' });
      }

      let voterId = '';

      if (adminAuthorized) {
        const candidateManagerIds = [
          req.body?.managerId,
          req.body?.manager_id,
          req.body?.voterId,
          req.body?.voter_id,
          req.query?.managerId,
          req.query?.manager_id,
          req.query?.voterId,
          req.query?.voter_id
        ];

        const normalizedManagerId = candidateManagerIds
          .map(value => (typeof value === 'string' ? value.trim() : ''))
          .find(value => value.length > 0);

        if (!normalizedManagerId) {
          return res
            .status(400)
            .json({ error: 'managerId is required when removing a vote as an admin' });
        }

        const managerRow = await getAsync('SELECT name_id FROM managers WHERE name_id = ?', [
          normalizedManagerId
        ]);

        if (!managerRow) {
          return res.status(404).json({ error: 'Manager not found' });
        }

        voterId = managerRow.name_id;
      } else {
        const manager = await requireManagerAuth(req, res);
        if (!manager) {
          return;
        }

        voterId = manager.name_id;
      }

      const proposalRow = await getAsync('SELECT * FROM rule_change_proposals WHERE id = ?', [
        proposalId
      ]);

      if (!proposalRow) {
        return res.status(404).json({ error: 'Proposal not found' });
      }

      if (!adminAuthorized) {
        const votingLocked = await isRuleChangeVotingLocked(proposalRow.season_year);
        if (votingLocked) {
          return res.status(403).json({ error: 'Voting has been locked for this season' });
        }
      }

      await runAsync('DELETE FROM rule_change_votes WHERE proposal_id = ? AND voter_id = ?', [
        proposalId,
        voterId
      ]);

      const voteRows = await allAsync(
        `SELECT v.proposal_id, v.option, v.voter_id, m.full_name
         FROM rule_change_votes v
         LEFT JOIN managers m ON v.voter_id = m.name_id
         WHERE v.proposal_id = ?`,
        [proposalId]
      );
      const activeManagerRows = await allAsync(
        'SELECT name_id, full_name FROM managers WHERE active = 1 ORDER BY full_name'
      );
      const voteDetailIndex = buildProposalVoteDetails(voteRows);
      const formatted = formatRuleChangeProposal(
        proposalRow,
        voteDetailIndex,
        {},
        mapManagersToSummaries(activeManagerRows)
      );

      res.json({ proposal: formatted });
    } catch (error) {
      console.error('Error deleting rule change vote:', error);
      res.status(500).json({ error: 'Failed to delete vote' });
    }
  });

  router.get('/rules', async (req, res) => {
    try {
      const row = await getAsync(
        'SELECT rules_content FROM league_rules WHERE active = 1 ORDER BY created_at DESC LIMIT 1'
      );
      res.json({ rules: row && typeof row.rules_content === 'string' ? row.rules_content : '' });
    } catch (error) {
      console.error('Error retrieving rules:', error);
      res.status(500).json({ error: 'Failed to retrieve rules' });
    }
  });

  router.put('/rules', async (req, res) => {
    const { rules } = req.body || {};

    if (typeof rules !== 'string' || rules.trim().length === 0) {
      return res.status(400).json({ error: 'Rules content is required' });
    }

    try {
      await runAsync('BEGIN TRANSACTION');
      await runAsync('UPDATE league_rules SET active = 0 WHERE active = 1');
      await runAsync(
        `INSERT INTO league_rules (rules_content, version, active, created_at, updated_at)
         VALUES (?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [rules]
      );
      await runAsync('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await runAsync('ROLLBACK');
      console.error('Error updating rules:', error);
      res.status(500).json({ error: 'Failed to update rules' });
    }
  });

  return router;
}

module.exports = {
  createRulesRouter,
  validateProposalReorderPayload
};
