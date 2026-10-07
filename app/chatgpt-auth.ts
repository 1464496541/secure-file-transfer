import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureSchema } from '@/lib/database';

export type AuthUser = {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  fullName: string | null;
  role: string;
};

/** @deprecated 兼容旧文件 API 导入名，实际为自有账号会话用户。 */
export type ChatGPTUser = AuthUser;

export const SESSION_COOKIE = 'securevault_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function requestMeta(request?: Request) {
  const h = request?.headers ?? await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    userAgent: h.get('user-agent') ?? '',
    ip: h.get('cf-connecting-ip') ?? h.get('x-real-ip') ?? forwarded ?? '127.0.0.1',
  };
}

export function sessionCookieOptions(request: Request) {
  const secure = new URL(request.url).protocol === 'https:';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await ensureSchema();
  const row = await db.prepare(`SELECT u.id user_id, u.username, u.display_name, u.email, u.role
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'`)
    .bind(token, new Date().toISOString())
    .first<{ user_id: string; username: string; display_name: string; email: string | null; role: string }>();
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    email: row.email ?? row.username,
    fullName: row.display_name,
    role: row.role,
  };
}

export async function getChatGPTUser(): Promise<AuthUser | null> {
  return getAuthUser();
}

export async function requireAuthUser(returnTo = '/'): Promise<AuthUser> {
  const user = await getAuthUser();
  if (user) return user;
  redirect(returnTo === '/' ? '/' : `/?return_to=${encodeURIComponent(returnTo)}`);
}

export async function requireChatGPTUser(returnTo = '/'): Promise<AuthUser> {
  return requireAuthUser(returnTo);
}

export async function requireAdmin(): Promise<AuthUser | Response> {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: '请先登录后使用。' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: '仅管理员可以查看登录记录。' }, { status: 403 });
  return user;
}

export function chatGPTSignInPath(_returnTo = '/') {
  return '/';
}

export function chatGPTSignOutPath(_returnTo = '/') {
  return '/api/auth/logout';
}
