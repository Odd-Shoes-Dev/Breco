// Auth provider: self-hosted JWT + bcrypt.
// To swap auth provider (e.g. Clerk, Auth0): replace this file only.
// The interface exported from index.ts stays the same.

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';

const COOKIE_NAME = 'breco_session';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-dev-secret-change-in-production'
);
const JWT_EXPIRES_IN = '7d';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

// Hash a plain-text password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify a plain-text password against a stored hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Sign a JWT and return it as a string
export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, fullName: user.fullName, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

// Verify a JWT string and return the payload, or null if invalid
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.sub as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

// Set the session cookie (server-side, called from API routes)
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

// Clear the session cookie (server-side, called from logout route)
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Read and verify the current session from cookies (server-side)
export async function getSession(cookieHeader?: string): Promise<SessionUser | null> {
  let token: string | undefined;

  if (cookieHeader) {
    // Parse from raw cookie header string (used in middleware)
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
    token = match ? match[1] : undefined;
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value;
  }

  if (!token) return null;
  return verifyToken(token);
}

// Attempt login: verify credentials and return the user if valid
export async function loginUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const rows = await sql`
    SELECT id, email, full_name, role, password_hash
    FROM users
    WHERE email = ${email.toLowerCase()} AND is_active = true
    LIMIT 1
  `;

  const user = rows[0];
  if (!user) return null;

  const valid = await verifyPassword(password, user.password_hash as string);
  if (!valid) return null;

  // Update last login timestamp
  await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`;

  return {
    id: user.id as string,
    email: user.email as string,
    fullName: user.full_name as string,
    role: user.role as string,
  };
}
