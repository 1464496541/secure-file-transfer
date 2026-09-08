import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureSchema, writeAudit } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });
  const { id } = await context.params;
  const db = await ensureSchema();
  const file = await db.prepare('SELECT r2_key AS r2Key, original_name AS name FROM files WHERE id = ? AND owner_id = ?')
    .bind(id, user.userId).first<{ r2Key: string; name: string }>();
  if (!file) return Response.json({ error: '文件不存在或无权删除。' }, { status: 404 });

  await env.FILES.delete(file.r2Key);
  await db.batch([
    db.prepare('DELETE FROM shares WHERE file_id = ?').bind(id),
    db.prepare('DELETE FROM files WHERE id = ? AND owner_id = ?').bind(id, user.userId),
  ]);
  await writeAudit({ actorId: user.userId, actorEmail: user.email, action: 'DELETE', fileId: id, detail: `删除文件：${file.name}` });
  return Response.json({ message: '文件已删除。' });
}
