import bcrypt from 'bcrypt';

import { UserStatus } from '@airbus-tools/shared';

import { ConflictError, NotFoundError, UnauthorizedError } from '../core/errors';
import { userRepository } from '../database/repositories/UserRepository';
import { enqueueEmail, newJobId } from '../jobs/queues';
import { signToken } from './jwt';
import type { RegisterInput, LoginInput, ChangePasswordInput } from './schemas';

const BCRYPT_ROUNDS = 12;
export const AUTH_COOKIE_NAME = 'access_token';

/**
 * Strips passwordHash from a Mongoose document and returns a plain user object.
 * The UserSchema toJSON transform also strips it, but we use lean-style access here
 * so we apply the transform manually.
 */
function sanitizeUser(user: Awaited<ReturnType<typeof userRepository.findByEmail>>) {
  if (!user) return null;
  const obj = user.toJSON() as Record<string, unknown>;
  delete obj.passwordHash;
  return obj;
}

export async function registerUser(input: RegisterInput) {
  const exists = await userRepository.emailExists(input.email);
  if (exists) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const createData: Partial<import('../database/models/User').IUserDocument> = {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    passwordHash,
    role: input.role,
    status: UserStatus.ACTIVE,
  };
  if (input.phoneNumber) {
    createData.phoneNumber = input.phoneNumber;
  }
  const user = await userRepository.create(createData);

  const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

  // Enqueue welcome email — fire-and-forget, does NOT block the response.
  void enqueueEmail({
    name: 'send-welcome',
    jobId: newJobId(),
    to: user.email,
    recipientName: user.firstName,
    userId: String(user._id),
  });

  return { token, user: sanitizeUser(user) };
}

export async function loginUser(input: LoginInput) {
  // Fetch user with passwordHash (toJSON strips it, so use direct property access)
  const user = await userRepository.findByEmail(input.email);

  // Use constant-time compare even when user doesn't exist (prevents timing attacks)
  const dummyHash = '$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const hash = user?.passwordHash ?? dummyHash;
  const isMatch = await bcrypt.compare(input.password, hash);

  if (!user || !isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedError('Account is not active');
  }

  await userRepository.updateLastLogin(String(user._id));

  const token = signToken({ sub: String(user._id), email: user.email, role: user.role });

  return { token, user: sanitizeUser(user) };
}

export async function getMe(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return sanitizeUser(user);
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const isMatch = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await userRepository.updateById(userId, { passwordHash: newHash });

  // Enqueue password-changed notification — fire-and-forget.
  void enqueueEmail({
    name: 'send-password-changed',
    jobId: newJobId(),
    to: user.email,
    recipientName: user.firstName,
    userId: userId,
    changedAt: new Date().toISOString(),
  });
}
