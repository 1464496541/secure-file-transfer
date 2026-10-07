import { requireAdmin } from '@/app/chatgpt-auth';
import { ensureSchema } from '@/lib/database';
import type { LoginLogRow } from '@/lib/login-log';

export const dynamic = 'force-dynamic';

function clampPage(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const username = url.searchParams.get('username')?.trim().toLowerCase() ?? '';
  const ip = url.searchParams.get('ip')?.trim() ?? '';
  const status = url.searchParams.get('status')?.trim() ?? '';
  const from = url.searchParams.get('from')?.trim() ?? '';
  const to = url.searchParams.get('to')?.trim() ?? '';
  const page = clampPage(url.searchParams.get('page'), 1, 10000);
  const pageSize = clampPage(url.searchParams.get('pageSize'), 20, 50);

  const where: string[] = ['1 = 1'];
  const params: Array<string | number> = [];
  if (username) {
    where.push('username LIKE ?');
    params.push(`%${username.replaceAll('%', '').replaceAll('_', '')}%`);
  }
  if (ip) {
    where.push('IFNULL(login_ip, \'\') LIKE ?');
    params.push(`%${ip.replaceAll('%', '').replaceAll('_', '')}%`);
  }
  if (status === 'success' || status === 'failure') {
    where.push('login_status = ?');
    params.push(status);
  }
  if (from && !Number.isNaN(Date.parse(from))) {
    where.push('login_time >= ?');
    params.push(new Date(from).toISOString());
  }
  if (to && !Number.isNaN(Date.parse(to))) {
    where.push('login_time <= ?');
    params.push(new Date(to).toISOString());
  }

  const clause = where.join(' AND ');
  const db = await ensureSchema();
  const offset = (page - 1) * pageSize;
  const [totalRow, list] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM login_logs WHERE ${clause}`).bind(...params).first<{ n: number }>(),
    db.prepare(`SELECT id, user_id, username, login_time, login_ip, user_agent, browser_name, browser_version,
        operating_system, device_type, login_method, login_status, failure_reason, session_id, logout_time
        FROM login_logs WHERE ${clause} ORDER BY login_time DESC LIMIT ? OFFSET ?`)
      .bind(...params, pageSize, offset)
      .all<LoginLogRow>(),
  ]);

  const total = Number(totalRow?.n ?? 0);
  return Response.json({
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: list.results ?? [],
  }, { headers: { 'Cache-Control': 'no-store' } });
}
