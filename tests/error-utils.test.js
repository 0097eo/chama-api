require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { isErrorWithMessage, isPrismaError } = require('../src/utils/error.utils');

test('isErrorWithMessage identifies objects with message strings', () => {
  const regularError = new Error('boom');
  assert.equal(isErrorWithMessage(regularError), true);

  const custom = { message: 'ok' };
  assert.equal(isErrorWithMessage(custom), true);
});

test('isErrorWithMessage rejects objects without string message', () => {
  assert.equal(isErrorWithMessage({ message: 10 }), false);
  assert.equal(isErrorWithMessage({}), false);
  assert.equal(isErrorWithMessage(null), false);
});

test('isPrismaError detects objects with a code property', () => {
  assert.equal(isPrismaError({ code: 'P2002' }), true);
});

test('isPrismaError rejects objects without code', () => {
  assert.equal(isPrismaError({ code: 123 }), false);
  assert.equal(isPrismaError({}), false);
  assert.equal(isPrismaError('P2002'), false);
});
