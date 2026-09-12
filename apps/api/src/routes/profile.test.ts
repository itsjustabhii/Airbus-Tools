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

async function createTestUser(overrides: Record<string, unknown> = {}) {
  const hash = await bcrypt.hash('Password123!', 10);
  return UserModel.create({
    email: 'pilot@airline.com',
    firstName: 'Jane',
    lastName: 'Doe',
    name: 'Jane Doe',
    bio: 'Experienced A320 Captain',
    company: 'Air France',
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

// ── GET /api/profile Authorization & Functionality ────────────────────────────

describe('GET /api/profile', () => {
  it('returns 401 Unauthorized when no auth cookie is present', async () => {
    const res = await request.get('/api/profile');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 Unauthorized when invalid token is provided', async () => {
    const res = await request
      .get('/api/profile')
      .set('Cookie', authCookie('invalid-token-value'));
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns authenticated user profile successfully on /api/profile and /api/v1/profile', async () => {
    const user = await createTestUser();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .get('/api/profile')
      .set('Cookie', authCookie(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      email: 'pilot@airline.com',
      firstName: 'Jane',
      lastName: 'Doe',
      name: 'Jane Doe',
      bio: 'Experienced A320 Captain',
      company: 'Air France',
      role: UserRole.AIRLINE,
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();

    // Verify /api/v1/profile also functions
    const resV1 = await request
      .get('/api/v1/profile')
      .set('Cookie', authCookie(token));
    expect(resV1.status).toBe(200);
    expect(resV1.body.data.user.email).toBe('pilot@airline.com');
  });
});

// ── PATCH /api/profile Authorization & Functionality ──────────────────────────

describe('PATCH /api/profile', () => {
  it('returns 401 Unauthorized when updating profile without auth', async () => {
    const res = await request.patch('/api/profile').send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('allows users to modify name, bio, and profile picture', async () => {
    const user = await createTestUser();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const updatePayload = {
      name: 'Captain Jane Doe',
      bio: 'Senior Fleet Instructor and A350 Captain',
      profilePicture: 'https://airbus-tools-uploads.s3.us-east-1.amazonaws.com/uploads/avatars/user-id/avatar.png',
    };

    const res = await request
      .patch('/api/profile')
      .set('Cookie', authCookie(token))
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.name).toBe(updatePayload.name);
    expect(res.body.data.user.bio).toBe(updatePayload.bio);
    expect(res.body.data.user.profilePicture).toBe(updatePayload.profilePicture);

    // Verify in database
    const dbUser = await UserModel.findById(user._id);
    expect(dbUser?.name).toBe(updatePayload.name);
    expect(dbUser?.bio).toBe(updatePayload.bio);
    expect(dbUser?.profilePicture).toBe(updatePayload.profilePicture);
  });

  it('rejects attempts to modify email, company, or role', async () => {
    const user = await createTestUser();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    // Try modifying email
    const resEmail = await request
      .patch('/api/profile')
      .set('Cookie', authCookie(token))
      .send({ email: 'hacker@airline.com' });
    expect(resEmail.status).toBe(422);

    // Try modifying company
    const resCompany = await request
      .patch('/api/profile')
      .set('Cookie', authCookie(token))
      .send({ company: 'Boeing' });
    expect(resCompany.status).toBe(422);

    // Try modifying role
    const resRole = await request
      .patch('/api/profile')
      .set('Cookie', authCookie(token))
      .send({ role: UserRole.ADMIN });
    expect(resRole.status).toBe(422);

    // Ensure database remained unchanged for protected fields
    const dbUser = await UserModel.findById(user._id);
    expect(dbUser?.email).toBe('pilot@airline.com');
    expect(dbUser?.company).toBe('Air France');
    expect(dbUser?.role).toBe(UserRole.AIRLINE);
  });
});

// ── PATCH /api/profile/password ───────────────────────────────────────────────

describe('PATCH /api/profile/password', () => {
  it('returns 401 when changing password without auth', async () => {
    const res = await request.patch('/api/profile/password').send({
      currentPassword: 'Password123!',
      newPassword: 'NewPassword123!',
    });
    expect(res.status).toBe(401);
  });

  it('successfully changes password when current password matches', async () => {
    const user = await createTestUser();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .patch('/api/profile/password')
      .set('Cookie', authCookie(token))
      .send({
        currentPassword: 'Password123!',
        newPassword: 'NewSecurePassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify user can login with new password
    const loginRes = await request.post('/api/auth/login').send({
      email: 'pilot@airline.com',
      password: 'NewSecurePassword123!',
    });
    expect(loginRes.status).toBe(200);
  });

  it('returns 401 when current password is incorrect', async () => {
    const user = await createTestUser();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .patch('/api/profile/password')
      .set('Cookie', authCookie(token))
      .send({
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewSecurePassword123!',
      });

    expect(res.status).toBe(401);
  });
});

// ── POST /api/uploads/presigned-url ──────────────────────────────────────────

describe('POST /api/uploads/presigned-url', () => {
  it('returns 401 when requesting upload URL unauthenticated (no public write access)', async () => {
    const res = await request.post('/api/uploads/presigned-url').send({
      contentType: 'image/jpeg',
    });
    expect(res.status).toBe(401);
  });

  it('generates presigned upload URL for authenticated user with valid payload', async () => {
    const user = await createTestUser();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .post('/api/uploads/presigned-url')
      .set('Cookie', authCookie(token))
      .send({
        contentType: 'image/jpeg',
        fileSize: 1024 * 100,
        fileName: 'avatar.jpg',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('uploadUrl');
    expect(res.body.data).toHaveProperty('fileUrl');
    expect(res.body.data).toHaveProperty('key');
    expect(res.body.data.uploadUrl).toContain('https://');
    expect(res.body.data.key).toContain(`uploads/avatars/${user._id}`);
  });

  it('rejects invalid content-types with 422', async () => {
    const user = await createTestUser();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .post('/api/uploads/presigned-url')
      .set('Cookie', authCookie(token))
      .send({
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('rejects files exceeding size limit with 422', async () => {
    const user = await createTestUser();
    const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

    const res = await request
      .post('/api/uploads/presigned-url')
      .set('Cookie', authCookie(token))
      .send({
        contentType: 'image/png',
        fileSize: 10 * 1024 * 1024, // 10MB > 5MB limit
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});
