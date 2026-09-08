import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureSchema, writeAudit } from '@/lib/database';

export const dynamic = 'force-dynamic';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { recipientEmail?: string; expiresHours?: number };
  const recipientEmail = body.recipientEmail?.trim().toLowerCase() ?? '';
  const expiresHours = Math.min(168, Math.max(1, Number(body.expiresHours) || 24));
  if (!EMAIL_PATTERN.test(recipientEmail)) return Response.json({ error: '请输入有效的收件人邮箱。' }, { status: 400 });
  if (recipientEmail === user.email.toLowerCase()) return Response.json({ error: '无需将文件共享给自己。' }, { status: 400 });

  const db = await ensureSchema();
  const file = await db.prepare('SELECT original_name AS name FROM files WHERE id = ? AND owner_id = ?')
    .bind(id, user.userId).first<{ name: string }>();
  if (!file) return Response.json({ error: '文件不存在或无权共享。' }, { status: 404 });

  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();
  await db.prepare(`INSERT INTO shares
    (id, file_id, owner_id, recipient_email, expires_at, created_at, download_count)
    VALUES (?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(file_id, recipient_email) DO UPDATE SET expires_at = excluded.expires_at, created_at = excluded.created_at`)
    .bind(crypto.randomUUID(), id, user.userId, recipientEmail, expiresAt, new Date().toISOString()).run();
  await writeAudit({
    actorId: user.userId,
    actorEmail: user.email,
    action: 'SHARE',
    fileId: id,
    detail: `将“${file.name}”共享给 ${recipientEmail}，有效期 ${expiresHours} 小时`,
  });
  return Response.json({ message: '共享权限已创建。', expiresAt });
}
