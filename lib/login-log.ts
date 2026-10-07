import { ensureSchema } from '@/lib/database';
import { parseClientEnvironment } from '@/lib/user-agent';

export type LoginStatus = 'success' | 'failure';

export type LoginLogRow = {
  id: string;
  user_id: string | null;
  username: string;
  login_time: string;
  login_ip: string | null;
  user_agent: string | null;
  browser_name: string | null;
  browser_version: string | null;
  operating_system: string | null;
  device_type: string | null;
  login_method: string | null;
  login_status: LoginStatus;
  failure_reason: string | null;
  session_id: string | null;
  logout_time: string | null;
};

export async function writeLoginLog(input: {
  request: Request;
  username: string;
  userId?: string | null;
  status: LoginStatus;
  failureReason?: string | null;
  sessionId?: string | null;
  ip: string;
  userAgent: string;
  loginMethod?: string;
}) {
  const db = await ensureSchema();
  const envInfo = parseClientEnvironment(input.userAgent, input.request);
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO login_logs (
      id, user_id, username, login_time, login_ip, user_agent,
      browser_name, browser_version, operating_system, device_type,
      login_status, failure_reason, session_id, logout_time, login_method
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`)
    .bind(
      id,
      input.userId ?? null,
      input.username,
      new Date().toISOString(),
      input.ip,
      input.userAgent.slice(0, 512),
      envInfo.browserName,
      envInfo.browserVersion.slice(0, 40),
      envInfo.operatingSystem.slice(0, 80),
      envInfo.deviceType,
      input.status,
      input.failureReason ?? null,
      input.sessionId ?? null,
      input.loginMethod ?? 'password',
    )
    .run();
  return id;
}

export async function markLogout(sessionId: string) {
  const db = await ensureSchema();
  await db.prepare('UPDATE login_logs SET logout_time = ? WHERE session_id = ? AND logout_time IS NULL')
    .bind(new Date().toISOString(), sessionId)
    .run();
}

export async function countRecentFailures(username: string, ip: string) {
  const db = await ensureSchema();
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM login_logs
      WHERE login_status = 'failure' AND login_time > ? AND (username = ? OR login_ip = ?)`)
    .bind(since, username, ip)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}
