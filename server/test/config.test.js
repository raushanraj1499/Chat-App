import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { runtimeConfig, validateEnvironment } from '../config/runtime.js';
import { createAuthLimiter } from '../middleware/rate-limit.js';

const valid = { MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET_KEY: 'secret',
    CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'test' };

test('configuration defaults to one origin; production cookies and clearing use identical options', () => {
    const local = runtimeConfig({});
    assert.equal(local.clientOrigin, 'http://localhost:5173');
    assert.equal(local.cookie.path, '/');
    assert.equal(local.cookie.httpOnly, true);
    const production = runtimeConfig({ NODE_ENV: 'production', APP_ORIGIN: 'https://chat.example.com' });
    assert.equal(production.clientOrigin, production.appOrigin);
    assert.equal(production.cookie.secure, true);
    assert.equal(production.cookie.sameSite, 'lax');
    assert.equal(runtimeConfig({ NODE_ENV: 'production', APP_ORIGIN: 'https://api.example.com',
        CLIENT_ORIGIN: 'https://other.example.org', COOKIE_SAME_SITE: 'none' }).cookie.sameSite, 'none');
    assert.throws(() => runtimeConfig({ NODE_ENV: 'production' }));
    assert.throws(() => runtimeConfig({ COOKIE_SAME_SITE: 'none' }));
    assert.throws(() => runtimeConfig({ CLIENT_ORIGIN: 'https://example.com/path' }));
    assert.throws(() => runtimeConfig({ PORT: 'bad' }));
});

test('missing configuration aborts startup before opening the HTTP listener', () => {
    for (const field of Object.keys(valid)) assert.throws(() => validateEnvironment({ ...valid, [field]: '' }));
    const result = spawnSync(process.execPath, ['server.js'], {
        cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
        env: { ...process.env, ...valid, MONGODB_URI: '', DOTENV_CONFIG_PATH: 'missing-test-env' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing required configuration: MONGODB_URI/);
    assert.doesNotMatch(result.stderr, /password|mongodb:\/\//);
});

test('unreachable MongoDB aborts startup rather than serving an unusable app', () => {
    const result = spawnSync(process.execPath, ['server.js'], {
        cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 15000,
        env: { ...process.env, ...valid, MONGODB_URI: 'mongodb://127.0.0.1:1/test', DOTENV_CONFIG_PATH: 'missing-test-env' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Startup failed/);
    assert.doesNotMatch(result.stdout, /listening/);
});

test('authentication limiter caps attempts and storage, ignores forwarded IP spoofing, and resets', () => {
    let time = 0;
    const limiter = createAuthLimiter({ limit: 2, maxKeys: 2, windowMs: 1000, now: () => time });
    function attempt(ip) {
        const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; },
            set(name, value) { this[name] = value; } };
        let accepted = false;
        limiter({ ip, headers: { 'x-forwarded-for': Math.random().toString() } }, res, () => { accepted = true; });
        return { res, accepted };
    }
    assert.ok(attempt('a').accepted);
    assert.ok(attempt('a').accepted);
    assert.equal(attempt('a').res.code, 429);
    assert.ok(attempt('b').accepted);
    assert.equal(attempt('c').res.code, 429);
    assert.equal(attempt('a').res['Retry-After'], '1');
    time = 1001;
    assert.ok(attempt('a').accepted);
});
