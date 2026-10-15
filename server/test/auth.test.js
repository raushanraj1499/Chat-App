import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import protect from '../middleware/auth.middleware.js';

const originalFindById = User.findById;
const originalSecret = process.env.JWT_SECRET_KEY;
const userId = '507f1f77bcf86cd799439011';
const tokenFor = () => jwt.sign({ _id: userId }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
beforeEach(() => { process.env.JWT_SECRET_KEY = 'test-session-secret'; });
afterEach(() => {
  User.findById = originalFindById;
  if (originalSecret === undefined) delete process.env.JWT_SECRET_KEY;
  else process.env.JWT_SECRET_KEY = originalSecret;
});

async function authenticate(token) {
  const req = { cookies: { token } };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  let error;
  await protect(req, res, err => { nextCalled = true; error = err; });
  return { req, res, nextCalled, error };
}

test('missing, invalid, and expired cookies return authentication failure', async () => {
  User.findById = () => { throw new Error('Should not query the database'); };
  const expired = jwt.sign({ _id: 'alice' }, process.env.JWT_SECRET_KEY, { expiresIn: -1 });
  for (const token of [undefined, 'invalid', expired]) {
    const result = await authenticate(token);
    assert.equal(result.res.statusCode, 401);
    assert.equal(result.nextCalled, false);
  }
});

test('a deleted user returns 401 instead of reaching the controller with a null user', async () => {
  User.findById = () => ({ select: async () => null });
  const result = await authenticate(tokenFor());
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('database outages propagate as server failures rather than authentication failures', async () => {
  const outage = new Error('Database unavailable');
  User.findById = () => ({ select: async () => { throw outage; } });
  const result = await authenticate(tokenFor());
  assert.equal(result.error, outage);
  assert.equal(result.res.statusCode, undefined);
});

test('an authenticated request gets the current user', async () => {
  const user = { _id: userId, username: 'Alice' };
  User.findById = () => ({ select: async () => user });
  const result = await authenticate(tokenFor());
  assert.equal(result.req.user, user);
  assert.equal(result.nextCalled, true);
  assert.equal(result.error, undefined);
});
