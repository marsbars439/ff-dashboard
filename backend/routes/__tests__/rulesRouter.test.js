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
