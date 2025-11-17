const test = require('node:test');
const assert = require('node:assert/strict');

const { validateProposalReorderPayload } = require('../rules');

test('validateProposalReorderPayload accepts a complete unique ordering', () => {
  const result = validateProposalReorderPayload([1, 2, 3], [2, 3, 1]);
  assert.equal(result.valid, true);
});

test('validateProposalReorderPayload rejects duplicate ids', () => {
  const result = validateProposalReorderPayload([1, 2, 3], [1, 2, 2]);
  assert.equal(result.valid, false);
  assert.match(result.error, /duplicate/i);
});

test('validateProposalReorderPayload rejects ids from other seasons', () => {
  const result = validateProposalReorderPayload([4, 5, 6], [4, 5, 99]);
  assert.equal(result.valid, false);
  assert.match(result.error, /seasonYear/i);
});

test('validateProposalReorderPayload requires every proposal id', () => {
  const result = validateProposalReorderPayload([7, 8, 9], [7, 9]);
  assert.equal(result.valid, false);
  assert.match(result.error, /every proposal/i);
});

test('validateProposalReorderPayload rejects partial payloads even when ids are valid', () => {
  const result = validateProposalReorderPayload([10, 11, 12, 13], [13, 12, 11]);
  assert.equal(result.valid, false);
  assert.match(result.error, /every proposal/i);
});

test('validateProposalReorderPayload reports 404 status when no proposals exist', () => {
  const result = validateProposalReorderPayload([], [1, 2, 3]);
  assert.equal(result.valid, false);
  assert.equal(result.status, 404);
  assert.match(result.error, /no proposals/i);
});
