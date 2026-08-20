import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { hashPassword, signToken, setSessionCookie } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName } = schema.parse(body);

    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const rows = await sql`
      INSERT INTO users (email, password_hash, full_name, role, is_active)
      VALUES (${email.toLowerCase()}, ${passwordHash}, ${fullName}, 'sales', true)
      RETURNING id, email, full_name, role
    `;

    const user = rows[0];
    const sessionUser = {
      id: user.id as string,
      email: user.email as string,
      fullName: user.full_name as string,
      role: user.role as string,
    };

    const token = await signToken(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json({ user: sessionUser }, { status: 201 });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request. Password must be at least 6 characters.' }, { status: 400 });
    }
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
