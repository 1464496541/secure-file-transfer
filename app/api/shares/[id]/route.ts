import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureSchema, prepareAudit, writeAudit } from '@/lib/database';

export const dynamic = 'force-dynamic';

type ShareRecord = {
  id: string;
  fileId: string;
  fileName: string;
  recipientEmail: string;
};

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录。' }, { status: 401 });

  const { id } = await context.params;
  const db = await ensureSchema();
  const share = await db.prepare(`SELECT s.id, s.file_id AS fileId,
    f.original_name AS fileName, s.recipient_email AS recipientEmail
    FROM shares s JOIN files f ON f.id = s.file_id
    WHERE s.id = ? AND s.owner_id = ?`)
    .bind(id, user.userId).first<ShareRecord>();

  if (!share) return Response.json({ error: '共享权限不存在或无权撤销。' }, { status: 404 });

  try {
    await db.batch([
      db.prepare('DELETE FROM shares WHERE id = ? AND owner_id = ?').bind(id, user.userId),
      prepareAudit(db, {
        actorId: user.userId,
        actorEmail: user.email,
        action: 'REVOKE_SHARE',
        fileId: share.fileId,
        detail: `撤销“${share.fileName}”对 ${share.recipientEmail} 的共享权限`,
      }),
    ]);
    return Response.json({ message: '共享权限已撤销。' });
  } catch {
    await writeAudit({ actorId: user.userId, actorEmail: user.email, action: 'REVOKE_SHARE_FAILED', fileId: share.fileId, detail: `撤销共享失败：${share.fileName}`, success: false }).catch(() => undefined);
    return Response.json({ error: '共享权限撤销失败，请稍后重试。' }, { status: 500 });
  }
}
