import { cookies } from 'next/headers';
import { createOAuthState, githubAuthorizeUrl, OAUTH_STATE_COOKIE, providerStatus, wechatAuthorizeUrl, type OAuthProvider } from '@/lib/oauth';
import { requestMeta, sessionCookieOptions } from '@/app/chatgpt-auth';
import { writeLoginLog } from '@/lib/login-log';

export const dynamic = 'force-dynamic';

const PROVIDERS: OAuthProvider[] = ['wechat', 'github'];

function isProvider(value: string): value is OAuthProvider {
  return PROVIDERS.includes(value as OAuthProvider);
}

function homeError(request: Request, message: string) {
  const url = new URL('/', request.url);
  url.searchParams.set('oauth_error', message);
  return Response.redirect(url, 302);
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await context.params;
  if (!isProvider(raw)) return homeError(request, '不支持该登录方式。');

  const enabled = providerStatus()[raw];
  const { ip, userAgent } = await requestMeta(request);
  if (!enabled) {
    await writeLoginLog({
      request,
      username: raw,
      status: 'failure',
      failureReason: 'oauth_unconfigured',
      ip,
      userAgent,
      loginMethod: raw,
    });
    return homeError(request, raw === 'wechat' ? '尚未配置微信开放平台 AppID。' : '尚未配置 GitHub OAuth 应用。');
  }

  const state = await createOAuthState(raw);
  const authorize = raw === 'wechat' ? wechatAuthorizeUrl(request, state) : githubAuthorizeUrl(request, state);
  if (!authorize) return homeError(request, '授权地址生成失败。');

  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, { ...sessionCookieOptions(request), maxAge: 600 });
  return Response.redirect(authorize, 302);
}
