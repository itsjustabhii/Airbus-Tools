import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { UserRole, UserStatus } from '@airbus-tools/shared';

import { createApp } from '../app';
import { signToken } from '../auth/jwt';
import { AUTH_COOKIE_NAME } from '../auth/service';
import { UserModel } from '../database/models/User';
import { setupTestDB, teardownTestDB, clearTestDB } from '../database/test-utils';

const app = createApp();
const request = supertest(app);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createUserInDB(overrides: Record<string, unknown> = {}) {
  const hash = await bcrypt.hash('Password1@secure', 10);
  return UserModel.create({
    email: 'pilot@airline.com',
    firstName: 'Jane',
    lastName: 'Doe',
    passwordHash: hash,
    role: UserRole.AIRLINE,
    status: UserStatus.ACTIVE,
    ...overrides,
  });
}

function authCookie(token: string): string {
  return `${AUTH_COOKIE_NAME}=${token}`;
}

// ── DB lifecycle ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

// ── POST /api/v1/auth/register ───────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  const validPayload = {
    email: 'newuser@supplier.com',
    password: 'Password1@secure',
    firstName: 'John',
    lastName: 'Smith',
    role: UserRole.SUPPLIER,
  };

  it('registers a new user and returns 201 with a cookie', async () => {
    const res = await request.post('/api/v1/auth/register').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.user.email).toBe('newuser@supplier.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 409 on duplicate email', async () => {
    await createUserInDB({ email: 'newuser@supplier.com' });

    const res = await request.post('/api/v1/auth/register').send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 422 when email is missing', async () => {
    const { email: _e, ...noEmail } = validPayload;
    const res = await request.post('/api/v1/auth/register').send(noEmail);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when password is too weak (no uppercase)', async () => {
    const res = await request
      .post('/api/v1/auth/register')
      .send({ ...validPayload, password: 'password1' });

    expect(res.status).toBe(422);
  });

  it('returns 422 when role is not AIRLINE or SUPPLIER', async () => {
    const res = await request
      .post('/api/v1/auth/register')
      .send({ ...validPayload, role: 'ADMIN' });

    expect(res.status).toBe(422);
  });

  it('never returns passwordHash in the response', async () => {
    const res = await request.post('/api/v1/auth/register').send(validPayload);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('passwordHash');
  });
});

// ── POST /api/v1/auth/login ──────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('returns 200 and sets a cookie on valid credentials', async () => {
    await createUserInDB();

    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'pilot@airline.com', password: 'Password1@secure' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 on wrong password', async () => {
    await createUserInDB();

    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'pilot@airline.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('returns 401 for unknown email', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password: 'Password1' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('returns a safe generic message (does not reveal whether email exists)', async () => {
    const res1 = await request
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password: 'Password1' });

    await createUserInDB();
    const res2 = await request
      .post('/api/v1/auth/login')
      .send({ email: 'pilot@airline.com', password: 'WrongPass1' });

    expect(res1.body.error.message).toBe(res2.body.error.message);
  });

  it('returns 422 when email is invalid format', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'Password1' });

    expect(res.status).toBe(422);
  });

  it('never returns passwordHash in the response', async () => {
    await createUserInDB();
    const res = await request
      .post('/api/v1/auth/login')
      .send({ email: 'pilot@airline.com', password: 'Password1@secure' });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('passwordHash');
  });
});

// ── POST /api/v1/auth/logout ─────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 and clears the cookie', async () => {
    const user = await createUserInDB();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .post('/api/v1/auth/logout')
      .set('Cookie', authCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Logged out successfully');

    const setCookieHeader = res.headers['set-cookie'] as string[] | undefined;
    expect(setCookieHeader?.some((c) => c.includes(`${AUTH_COOKIE_NAME}=;`))).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await request.post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/auth/me ──────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('returns the authenticated user profile', async () => {
    const user = await createUserInDB();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('pilot@airline.com');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie('this.is.garbage'));

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid token');
  });

  it('returns 401 for an expired token', async () => {
    const user = await createUserInDB();
    // Sign a token that expired 1 second ago
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });
    // Manually craft an already-expired token via jsonwebtoken
    const jwt = await import('jsonwebtoken');
    const config = await import('../config/env');
    const expiredToken = jwt.default.sign(
      { sub: String(user._id), email: user.email, role: user.role },
      config.config.JWT_SECRET,
      { expiresIn: -1 },
    );
    void token; // unused, just ensures the fixture user exists

    const res = await request
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie(expiredToken));

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Token has expired');
  });
});

// ── PATCH /api/v1/auth/password ──────────────────────────────────────────────

describe('PATCH /api/v1/auth/password', () => {
  it('changes the password when credentials are correct', async () => {
    const user = await createUserInDB();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .patch('/api/v1/auth/password')
      .set('Cookie', authCookie(token))
      .send({ currentPassword: 'Password1@secure', newPassword: 'NewPass2@secure' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Password updated successfully');

    // Verify new password actually works at login
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: 'pilot@airline.com', password: 'NewPass2@secure' });
    expect(loginRes.status).toBe(200);
  });

  it('returns 401 when current password is wrong', async () => {
    const user = await createUserInDB();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .patch('/api/v1/auth/password')
      .set('Cookie', authCookie(token))
      .send({ currentPassword: 'WrongPass1@secure', newPassword: 'NewPass2@secure' });

    expect(res.status).toBe(401);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request
      .patch('/api/v1/auth/password')
      .send({ currentPassword: 'Password1@secure', newPassword: 'NewPass2@secure' });

    expect(res.status).toBe(401);
  });

  it('returns 422 when new password does not meet requirements', async () => {
    const user = await createUserInDB();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .patch('/api/v1/auth/password')
      .set('Cookie', authCookie(token))
      .send({ currentPassword: 'Password1', newPassword: 'weak' });

    expect(res.status).toBe(422);
  });
});

// ── Role authorization (authorize middleware) ────────────────────────────────

describe('authorize middleware (role guard)', () => {
  // We mount a tiny protected route inline for testing the authorize middleware.
  // Instead, we verify it end-to-end via the real auth routes where AIRLINE/SUPPLIER
  // are the allowed roles and anything else would be forbidden.

  it('AIRLINE user can access /me', async () => {
    const user = await createUserInDB({ role: UserRole.AIRLINE });
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie(token));

    expect(res.status).toBe(200);
  });

  it('SUPPLIER user can access /me', async () => {
    const user = await createUserInDB({ role: UserRole.SUPPLIER, email: 'supplier@co.com' });
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie(token));

    expect(res.status).toBe(200);
  });
});

// ── Role mutation protection ─────────────────────────────────────────────────

describe('role mutation protection', () => {
  it('register endpoint does not accept admin role', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      email: 'hacker@example.com',
      password: 'Password1@secure',
      firstName: 'Bad',
      lastName: 'Actor',
      role: 'ADMIN',
    });

    expect(res.status).toBe(422);
  });

  it('PATCH /password does not let users change their role', async () => {
    const user = await createUserInDB();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    // The password endpoint only accepts currentPassword + newPassword
    // Any extra field like "role" should be ignored (Zod strict parse or just silently ignored)
    const res = await request
      .patch('/api/v1/auth/password')
      .set('Cookie', authCookie(token))
      .send({ currentPassword: 'Password1@secure', newPassword: 'NewPass2@secure', role: 'ADMIN' });

    expect(res.status).toBe(200);

    // Confirm role hasn't changed
    const meRes = await request
      .get('/api/v1/auth/me')
      .set('Cookie', authCookie(token));
    expect(meRes.body.data.user.role).toBe(UserRole.AIRLINE);
  });
});
