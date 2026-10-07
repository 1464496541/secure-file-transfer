import { getAuthUser, requestMeta } from '@/app/chatgpt-auth';
import { establishSession } from '@/lib/auth-session';
import { normalizeUsername, validateUsername } from '@/lib/auth-rules';
import { ensureSchema } from '@/lib/database';
import { countRecentFailures, writeLoginLog } from '@/lib/login-log';
import { verifyPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

type LoginBody = { username?: string; password?: string };

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = await request.json() as LoginBody;
  } catch {
    return Response.json({ error: '请求格式无效。' }, { status: 400 });
  }

  const username = normalizeUsername(body.username ?? '');
  const password = body.password ?? '';
  const usernameError = validateUsername(username);
  if (usernameError || !password) {
    return Response.json({ error: '请输入有效账号和密码。' }, { status: 400 });
  }

  const { ip, userAgent } = await requestMeta(request);
  if (await countRecentFailures(username, ip) >= 12) {
    await writeLoginLog({ request, username, status: 'failure', failureReason: 'rate_limited', ip, userAgent, loginMethod: 'password' });
    return Response.json({ error: '尝试次数过多，请 15 分钟后再试。' }, { status: 429 });
  }

  const db = await ensureSchema();
  const user = await db.prepare('SELECT id, username, password_hash, display_name, email, role, status FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: string; username: string; password_hash: string; display_name: string; email: string | null; role: string; status: string }>();

  const passwordOk = user ? await verifyPassword(password, user.password_hash) : await verifyPassword(password, 'pbkdf2$120000$AAAA$AAAA');
  if (!user || !passwordOk) {
    await writeLoginLog({
      request,
      username,
      userId: user?.id,
      status: 'failure',
      failureReason: user ? 'bad_password' : 'user_not_found',
      ip,
      userAgent,
      loginMethod: 'password',
    });
    return Response.json({ error: '账号或密码错误。' }, { status: 401 });
  }

  if (user.status !== 'active') {
    await writeLoginLog({ request, username, userId: user.id, status: 'failure', failureReason: 'disabled', ip, userAgent, loginMethod: 'password' });
    return Response.json({ error: '账号已被停用，请联系管理员。' }, { status: 403 });
  }

  await establishSession(request, { id: user.id, username: user.username }, 'password');

  return Response.json({
    user: {
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email ?? user.username,
      role: user.role,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: '未登录。' }, { status: 401 });
  return Response.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
