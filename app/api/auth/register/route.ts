import { normalizeUsername, validateDisplayName, validateOptionalEmail, validatePassword, validateUsername } from '@/lib/auth-rules';
import { ensureSchema } from '@/lib/database';
import { hashPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

type RegisterBody = { username?: string; password?: string; displayName?: string; email?: string };

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = await request.json() as RegisterBody;
  } catch {
    return Response.json({ error: '请求格式无效。' }, { status: 400 });
  }

  const username = normalizeUsername(body.username ?? '');
  const password = body.password ?? '';
  const displayName = (body.displayName ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();

  const error = validateUsername(username) || validatePassword(password) || validateDisplayName(displayName) || validateOptionalEmail(email);
  if (error) return Response.json({ error }, { status: 400 });

  const db = await ensureSchema();
  const exists = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exists) return Response.json({ error: '该账号已被注册。' }, { status: 409 });

  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO users
      (id, username, password_hash, display_name, email, role, status, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, 'user', 'active', ?, ?, NULL)`)
    .bind(crypto.randomUUID(), username, await hashPassword(password), displayName, email || null, now, now)
    .run();

  return Response.json({ message: '注册成功，请使用账号密码登录。' }, { status: 201 });
}
