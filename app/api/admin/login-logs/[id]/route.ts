import { requireAdmin } from '@/app/chatgpt-auth';
import { ensureSchema } from '@/lib/database';
import type { LoginLogRow } from '@/lib/login-log';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await context.params;
  if (!id) return Response.json({ error: '缺少记录编号。' }, { status: 400 });

  const db = await ensureSchema();
  const row = await db.prepare(`SELECT id, user_id, username, login_time, login_ip, user_agent, browser_name, browser_version,
      operating_system, device_type, login_method, login_status, failure_reason, session_id, logout_time
      FROM login_logs WHERE id = ?`)
    .bind(id)
    .first<LoginLogRow>();

  if (!row) return Response.json({ error: '登录记录不存在。' }, { status: 404 });
  return Response.json({ item: row }, { headers: { 'Cache-Control': 'no-store' } });
}
