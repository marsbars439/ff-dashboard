/**
 * Manager Service
 * Helper functions for manager-related operations
 */

/**
 * Get emails for manager IDs
 * @param {number[]} managerIds - Array of manager IDs
 * @param {Object} db - Database connection with allAsync helper
 * @returns {Promise<Map<number, string[]>>} Map of manager IDs to email arrays
 */
async function getEmailsForManagerIds(managerIds, db) {
  if (!Array.isArray(managerIds) || managerIds.length === 0) {
    return new Map();
  }

  const validIds = managerIds.filter(id =>
    Number.isInteger(id) && !Number.isNaN(id) && id > 0
  );

  if (validIds.length === 0) {
    return new Map();
  }

  const placeholders = validIds.map(() => '?').join(', ');
  const rows = await db.allAsync(
    `SELECT manager_id, email, is_primary
     FROM manager_emails
     WHERE manager_id IN (${placeholders})
     ORDER BY manager_id, is_primary DESC, id ASC`,
    validIds
  );

  const emailMap = new Map();

  rows.forEach(row => {
    if (!emailMap.has(row.manager_id)) {
      emailMap.set(row.manager_id, []);
    }

    emailMap.get(row.manager_id).push(row.email);
  });

  return emailMap;
}

/**
 * Hydrate managers with their email addresses
 * @param {Object[]} managerRows - Array of manager objects
 * @param {Object} db - Database connection with allAsync helper
 * @returns {Promise<Object[]>} Managers with emails added
 */
async function hydrateManagersWithEmails(managerRows = [], db) {
  if (!Array.isArray(managerRows) || managerRows.length === 0) {
    return [];
  }

  const ids = managerRows
    .map(row => Number(row?.id))
    .filter(id => Number.isInteger(id) && !Number.isNaN(id));

  const emailMap = await getEmailsForManagerIds(ids, db);

  return managerRows.map(row => {
    const emails = emailMap.get(row.id) || [];
    return {
      ...row,
      emails,
      email: emails[0] || (typeof row.email === 'string' ? row.email : '')
    };
  });
}

module.exports = {
  getEmailsForManagerIds,
  hydrateManagersWithEmails
};
