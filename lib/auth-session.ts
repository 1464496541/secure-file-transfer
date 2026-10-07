import { cookies } from 'next/headers';
import { requestMeta, SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from '@/app/chatgpt-auth';
import { ensureSchema } from '@/lib/database';
import { writeLoginLog } from '@/lib/login-log';

export type LoginMethod = 'password' | 'wechat' | 'github';

export async function establishSession(request: Request, user: {
  id: string;
  username: string;
}, loginMethod: LoginMethod) {
  const { ip, userAgent } = await requestMeta(request);
  const db = await ensureSchema();
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  await db.batch([
    db.prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(sessionId, user.id, expiresAt, now.toISOString(), userAgent.slice(0, 512), ip),
    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(now.toISOString(), now.toISOString(), user.id),
  ]);
  await writeLoginLog({
    request,
    username: user.username,
    userId: user.id,
    status: 'success',
    sessionId,
    ip,
    userAgent,
    loginMethod,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, sessionCookieOptions(request));
  return sessionId;
}
