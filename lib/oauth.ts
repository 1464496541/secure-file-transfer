import { env } from 'cloudflare:workers';
import { ensureSchema } from '@/lib/database';
import { hashPassword } from '@/lib/password';

export type OAuthProvider = 'wechat' | 'github';

export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  displayName: string;
  email: string | null;
  usernameHint: string;
};

export const OAUTH_STATE_COOKIE = 'securevault_oauth_state';

export function oauthCallbackUrl(request: Request, provider: OAuthProvider) {
  const origin = env.SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin;
  return `${origin}/api/auth/oauth/${provider}/callback`;
}

export function isWeChatBrowser(userAgent: string) {
  return /MicroMessenger/i.test(userAgent);
}

export function providerStatus() {
  return {
    wechat: Boolean(env.WECHAT_APP_ID && env.WECHAT_APP_SECRET),
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  };
}

export async function createOAuthState(provider: OAuthProvider) {
  const db = await ensureSchema();
  const state = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO oauth_states (id, provider, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(state, provider, expiresAt, new Date().toISOString())
    .run();
  return state;
}

export async function consumeOAuthState(state: string, provider: OAuthProvider) {
  const db = await ensureSchema();
  const row = await db.prepare('SELECT provider, expires_at FROM oauth_states WHERE id = ?')
    .bind(state)
    .first<{ provider: string; expires_at: string }>();
  await db.prepare('DELETE FROM oauth_states WHERE id = ?').bind(state).run();
  if (!row || row.provider !== provider || row.expires_at < new Date().toISOString()) return false;
  return true;
}

function sanitizeUsername(hint: string, prefix: string) {
  const cleaned = hint.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  const body = cleaned && /^[a-z]/.test(cleaned) ? cleaned : `${prefix}${cleaned || crypto.randomUUID().slice(0, 8)}`;
  return body.slice(0, 32);
}

async function uniqueUsername(base: string) {
  const db = await ensureSchema();
  let candidate = base;
  for (let i = 0; i < 8; i += 1) {
    const exists = await db.prepare('SELECT id FROM users WHERE username = ?').bind(candidate).first();
    if (!exists) return candidate;
    candidate = `${base.slice(0, 24)}_${crypto.randomUUID().slice(0, 4)}`;
  }
  return `u${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

export async function findOrCreateOAuthUser(profile: OAuthProfile) {
  const db = await ensureSchema();
  const linked = await db.prepare(`SELECT u.id, u.username, u.display_name, u.email, u.role, u.status
      FROM oauth_accounts o JOIN users u ON u.id = o.user_id
      WHERE o.provider = ? AND o.provider_user_id = ?`)
    .bind(profile.provider, profile.providerUserId)
    .first<{ id: string; username: string; display_name: string; email: string | null; role: string; status: string }>();
  if (linked) return linked;

  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const username = await uniqueUsername(sanitizeUsername(profile.usernameHint, profile.provider === 'wechat' ? 'wx' : 'gh'));
  const placeholderHash = await hashPassword(`oauth-${crypto.randomUUID()}`);
  await db.batch([
    db.prepare(`INSERT INTO users
        (id, username, password_hash, display_name, email, role, status, created_at, updated_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, 'user', 'active', ?, ?, NULL)`)
      .bind(userId, username, placeholderHash, profile.displayName.slice(0, 40) || username, profile.email, now, now),
    db.prepare(`INSERT INTO oauth_accounts
        (id, user_id, provider, provider_user_id, display_name, email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), userId, profile.provider, profile.providerUserId, profile.displayName.slice(0, 80), profile.email, now, now),
  ]);
  return { id: userId, username, display_name: profile.displayName, email: profile.email, role: 'user', status: 'active' };
}

export function wechatAuthorizeUrl(request: Request, state: string) {
  const appId = env.WECHAT_APP_ID;
  if (!appId) return null;
  const redirectUri = encodeURIComponent(oauthCallbackUrl(request, 'wechat'));
  const ua = request.headers.get('user-agent') ?? '';
  if (isWeChatBrowser(ua)) {
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${encodeURIComponent(appId)}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=${encodeURIComponent(state)}#wechat_redirect`;
  }
  return `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(appId)}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${encodeURIComponent(state)}#wechat_redirect`;
}

export function githubAuthorizeUrl(request: Request, state: string) {
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) return null;
  const redirectUri = encodeURIComponent(oauthCallbackUrl(request, 'github'));
  return `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${redirectUri}&scope=${encodeURIComponent('read:user user:email')}&state=${encodeURIComponent(state)}`;
}

type WeChatToken = { access_token?: string; openid?: string; unionid?: string; errcode?: number; errmsg?: string };
type WeChatUser = { openid?: string; unionid?: string; nickname?: string; errcode?: number; errmsg?: string };

export async function fetchWeChatProfile(code: string): Promise<OAuthProfile> {
  const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${encodeURIComponent(env.WECHAT_APP_ID || '')}&secret=${encodeURIComponent(env.WECHAT_APP_SECRET || '')}&code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const token = await (await fetch(tokenUrl)).json() as WeChatToken;
  if (!token.access_token || !token.openid) {
    throw new Error(token.errmsg || '微信授权失败。');
  }
  const infoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${encodeURIComponent(token.access_token)}&openid=${encodeURIComponent(token.openid)}`;
  const info = await (await fetch(infoUrl)).json() as WeChatUser;
  if (info.errcode) throw new Error(info.errmsg || '无法读取微信资料。');
  const providerUserId = info.unionid || token.unionid || token.openid;
  const nickname = info.nickname?.trim() || '微信用户';
  return {
    provider: 'wechat',
    providerUserId,
    displayName: nickname,
    email: null,
    usernameHint: `wx${providerUserId.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}`,
  };
}

type GitHubUser = { id?: number; login?: string; name?: string; email?: string | null };
type GitHubEmail = { email: string; primary: boolean; verified: boolean };

export async function fetchGitHubProfile(code: string, request: Request): Promise<OAuthProfile> {
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: oauthCallbackUrl(request, 'github'),
    }),
  });
  const tokenPayload = await tokenResponse.json() as { access_token?: string; error_description?: string };
  if (!tokenPayload.access_token) throw new Error(tokenPayload.error_description || 'GitHub 授权失败。');

  const headers = { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'SecureVault' };
  const user = await (await fetch('https://api.github.com/user', { headers })).json() as GitHubUser;
  if (!user.id || !user.login) throw new Error('无法读取 GitHub 资料。');
  let email = user.email ?? null;
  if (!email) {
    const emails = await (await fetch('https://api.github.com/user/emails', { headers })).json() as GitHubEmail[] | { message?: string };
    if (Array.isArray(emails)) {
      email = emails.find((item) => item.primary && item.verified)?.email
        ?? emails.find((item) => item.verified)?.email
        ?? null;
    }
  }
  return {
    provider: 'github',
    providerUserId: String(user.id),
    displayName: user.name?.trim() || user.login,
    email,
    usernameHint: user.login,
  };
}
