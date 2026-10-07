import { cookies } from 'next/headers';
import { establishSession } from '@/lib/auth-session';
import { consumeOAuthState, fetchGitHubProfile, fetchWeChatProfile, findOrCreateOAuthUser, OAUTH_STATE_COOKIE, type OAuthProvider } from '@/lib/oauth';
import { requestMeta } from '@/app/chatgpt-auth';
import { writeLoginLog } from '@/lib/login-log';

export const dynamic = 'force-dynamic';

function isProvider(value: string): value is OAuthProvider {
  return value === 'wechat' || value === 'github';
}

function home(request: Request, error?: string) {
  const url = new URL('/', request.url);
  if (error) url.searchParams.set('oauth_error', error);
  return Response.redirect(url, 302);
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await context.params;
  if (!isProvider(raw)) return home(request, '不支持该登录方式。');

  const url = new URL(request.url);
  const denied = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const { ip, userAgent } = await requestMeta(request);
  const cookieState = (await cookies()).get(OAUTH_STATE_COOKIE)?.value;

  if (denied) {
    await writeLoginLog({ request, username: raw, status: 'failure', failureReason: 'oauth_denied', ip, userAgent, loginMethod: raw });
    return home(request, '已取消授权登录。');
  }
  if (!code || !state || !cookieState || cookieState !== state || !(await consumeOAuthState(state, raw))) {
    await writeLoginLog({ request, username: raw, status: 'failure', failureReason: 'oauth_invalid_state', ip, userAgent, loginMethod: raw });
    return home(request, '授权状态无效，请重新登录。');
  }

  try {
    const profile = raw === 'wechat' ? await fetchWeChatProfile(code) : await fetchGitHubProfile(code, request);
    const user = await findOrCreateOAuthUser(profile);
    if (user.status !== 'active') {
      await writeLoginLog({ request, username: user.username, userId: user.id, status: 'failure', failureReason: 'disabled', ip, userAgent, loginMethod: raw });
      return home(request, '账号已被停用，请联系管理员。');
    }
    await establishSession(request, { id: user.id, username: user.username }, raw);
    const jar = await cookies();
    jar.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
    return home(request);
  } catch (error) {
    await writeLoginLog({
      request,
      username: raw,
      status: 'failure',
      failureReason: 'oauth_failed',
      ip,
      userAgent,
      loginMethod: raw,
    });
    return home(request, error instanceof Error ? error.message : '联网登录失败。');
  }
}
