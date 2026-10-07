import { cookies } from 'next/headers';
import { SESSION_COOKIE, sessionCookieOptions } from '@/app/chatgpt-auth';
import { ensureSchema } from '@/lib/database';
import { markLogout } from '@/lib/login-log';

export const dynamic = 'force-dynamic';

async function clearSession(request: Request) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await ensureSchema();
    await Promise.all([
      db.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run(),
      markLogout(token),
    ]);
  }
  jar.set(SESSION_COOKIE, '', { ...sessionCookieOptions(request), maxAge: 0 });
}

export async function POST(request: Request) {
  await clearSession(request);
  return Response.json({ message: '已退出登录。' }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  await clearSession(request);
  const origin = new URL(request.url).origin;
  return Response.redirect(new URL('/', origin), 303);
}
