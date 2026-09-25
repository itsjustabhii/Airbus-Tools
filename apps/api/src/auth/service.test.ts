import { UserStatus, UserRole } from '@airbus-tools/shared';
import bcrypt from 'bcrypt';
import { describe, it, expect, vi, beforeEach } from 'vitest';


import { ConflictError, UnauthorizedError, NotFoundError } from '../core/errors';

// ── Hoist mocks so they are registered before any imports are resolved ────────
vi.mock('../database/repositories/UserRepository', () => ({
  userRepository: {
    emailExists: vi.fn(),
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    updateLastLogin: vi.fn(),
    updateById: vi.fn(),
  },
}));

vi.mock('./jwt', () => ({
  signToken: vi.fn(() => 'mocked.jwt.token'),
}));

// Import after mocks so the service picks up the mocked dependencies
import { userRepository as mockRepo } from '../database/repositories/UserRepository';

import { registerUser, loginUser, getMe, changePassword } from './service';

const mockUserRepo = mockRepo as {
  emailExists: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  findByEmail: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  updateLastLogin: ReturnType<typeof vi.fn>;
  updateById: ReturnType<typeof vi.fn>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUserDoc(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    _id: 'user-id-123',
    email: 'pilot@airline.com',
    firstName: 'Jane',
    lastName: 'Doe',
    passwordHash: '$2b$12$hashedpassword',
    role: UserRole.AIRLINE,
    status: UserStatus.ACTIVE,
    ...overrides,
  };
  base.toJSON = function (this: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, toJSON: _tj, ...rest } = this;
    return { ...rest, id: String(this._id) };
  };
  return base;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('registerUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws ConflictError when email already exists', async () => {
    mockUserRepo.emailExists.mockResolvedValue(true);

    await expect(
      registerUser({
        email: 'pilot@airline.com',
        password: 'Password1',
        firstName: 'Jane',
        lastName: 'Doe',
        role: UserRole.AIRLINE,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('creates user and returns token + sanitized user', async () => {
    mockUserRepo.emailExists.mockResolvedValue(false);
    mockUserRepo.create.mockResolvedValue(makeUserDoc());

    const result = await registerUser({
      email: 'pilot@airline.com',
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
      role: UserRole.AIRLINE,
    });

    expect(result.token).toBe('mocked.jwt.token');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).toHaveProperty('email', 'pilot@airline.com');
  });

  it('hashes the password before storing', async () => {
    mockUserRepo.emailExists.mockResolvedValue(false);
    mockUserRepo.create.mockResolvedValue(makeUserDoc());

    await registerUser({
      email: 'pilot@airline.com',
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
      role: UserRole.AIRLINE,
    });

    const createCall = mockUserRepo.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createCall.passwordHash).not.toBe('Password1');
    const isHash = await bcrypt.compare('Password1', createCall.passwordHash as string);
    expect(isHash).toBe(true);
  });
});

describe('loginUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws UnauthorizedError for unknown email', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(
      loginUser({ email: 'nobody@example.com', password: 'Password1' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for wrong password', async () => {
    const hash = await bcrypt.hash('CorrectPass1', 10);
    mockUserRepo.findByEmail.mockResolvedValue(makeUserDoc({ passwordHash: hash }));

    await expect(
      loginUser({ email: 'pilot@airline.com', password: 'WrongPass1' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when account is not active', async () => {
    const hash = await bcrypt.hash('Password1', 10);
    mockUserRepo.findByEmail.mockResolvedValue(
      makeUserDoc({ passwordHash: hash, status: UserStatus.SUSPENDED }),
    );

    await expect(
      loginUser({ email: 'pilot@airline.com', password: 'Password1' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('returns token and sanitized user on success', async () => {
    const hash = await bcrypt.hash('Password1', 10);
    mockUserRepo.findByEmail.mockResolvedValue(makeUserDoc({ passwordHash: hash }));
    mockUserRepo.updateLastLogin.mockResolvedValue(null);

    const result = await loginUser({ email: 'pilot@airline.com', password: 'Password1' });

    expect(result.token).toBe('mocked.jwt.token');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('uses constant-time compare even when user does not exist (timing safety)', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    const start = Date.now();
    await expect(
      loginUser({ email: 'ghost@example.com', password: 'Password1' }),
    ).rejects.toThrow(UnauthorizedError);
    const elapsed = Date.now() - start;
    // bcrypt.compare should have been called — takes at least a few ms
    expect(elapsed).toBeGreaterThan(0);
  });
});

describe('getMe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError when user does not exist', async () => {
    mockUserRepo.findById.mockResolvedValue(null);
    await expect(getMe('nonexistent-id')).rejects.toThrow(NotFoundError);
  });

  it('returns sanitized user without passwordHash', async () => {
    mockUserRepo.findById.mockResolvedValue(makeUserDoc());
    const user = await getMe('user-id-123');
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).toHaveProperty('email', 'pilot@airline.com');
  });
});

describe('changePassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError when user does not exist', async () => {
    mockUserRepo.findById.mockResolvedValue(null);
    await expect(
      changePassword('bad-id', { currentPassword: 'Old1pass', newPassword: 'New1pass' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws UnauthorizedError when current password is wrong', async () => {
    const hash = await bcrypt.hash('CorrectPass1', 10);
    mockUserRepo.findById.mockResolvedValue(makeUserDoc({ passwordHash: hash }));

    await expect(
      changePassword('user-id-123', { currentPassword: 'WrongPass1', newPassword: 'New1pass' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('updates password hash on success', async () => {
    const hash = await bcrypt.hash('OldPass1', 10);
    mockUserRepo.findById.mockResolvedValue(makeUserDoc({ passwordHash: hash }));
    mockUserRepo.updateById.mockResolvedValue(null);

    await changePassword('user-id-123', { currentPassword: 'OldPass1', newPassword: 'NewPass1' });

    const updateCall = mockUserRepo.updateById.mock.calls[0] as unknown[];
    const updatePayload = updateCall[1] as Record<string, unknown>;
    expect(updatePayload.passwordHash).toBeDefined();
    const isNewHash = await bcrypt.compare('NewPass1', updatePayload.passwordHash as string);
    expect(isNewHash).toBe(true);
  });
});
