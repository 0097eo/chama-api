process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1s';

require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { generateToken, generateRefreshToken, verifyToken } = require('../src/utils/jwt.utils');

test('generateToken issues a token that verifyToken can decode', () => {
  const token = generateToken({ userId: '123' });
  const decoded = verifyToken(token);
  assert.equal(typeof token, 'string');
  assert.ok(decoded && typeof decoded === 'object');
  assert.equal(decoded.userId, '123');
});

test('generateRefreshToken produces a different token', () => {
  const accessToken = generateToken({ id: 'abc' });
  const refreshToken = generateRefreshToken({ id: 'abc' });
  assert.notEqual(refreshToken, accessToken);
  assert.equal(typeof refreshToken, 'string');
});

test('verifyToken returns null for tampered token', () => {
  const token = generateToken({ role: 'admin' });
  const tampered = token.replace(/.$/, 'x');
  const result = verifyToken(tampered);
  assert.equal(result, null);
});
