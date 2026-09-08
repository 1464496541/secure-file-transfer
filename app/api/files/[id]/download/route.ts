import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { decryptFile } from '@/lib/crypto';
import { ensureSchema, writeAudit } from '@/lib/database';

export const dynamic = 'force-dynamic';

type FileRecord = {
  id: string;
  ownerId: string;
  name: string;
  mimeType: string;
  r2Key: string;
  iv: string;
  wrappedKey: string;
  sha256: string;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录后下载文件。' }, { status: 401 });
  const { id } = await context.params;
  const db = await ensureSchema();
  const file = await db.prepare(`SELECT id, owner_id AS ownerId, original_name AS name,
    mime_type AS mimeType, r2_key AS r2Key, iv, wrapped_key AS wrappedKey, sha256
    FROM files WHERE id = ?`).bind(id).first<FileRecord>();
  if (!file) return Response.json({ error: '文件不存在。' }, { status: 404 });

  let shareId: string | null = null;
  if (file.ownerId !== user.userId) {
    const share = await db.prepare(`SELECT id FROM shares
      WHERE file_id = ? AND lower(recipient_email) = lower(?) AND expires_at > ?`)
      .bind(id, user.email, new Date().toISOString()).first<{ id: string }>();
    if (!share) return Response.json({ error: '共享已过期或您无权下载。' }, { status: 403 });
    shareId = share.id;
  }

  try {
    const object = await env.FILES.get(file.r2Key);
    if (!object) throw new Error('加密文件对象不存在。');
    const plain = await decryptFile(await object.arrayBuffer(), file.id, file.ownerId, file.iv, file.wrappedKey);
    const digest = await crypto.subtle.digest('SHA-256', plain);
    const actualHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (actualHash !== file.sha256) throw new Error('完整性校验失败，文件可能已被篡改。');

    if (shareId) await db.prepare('UPDATE shares SET download_count = download_count + 1 WHERE id = ?').bind(shareId).run();
    await writeAudit({ actorId: user.userId, actorEmail: user.email, action: 'DOWNLOAD', fileId: id, detail: `解密并下载文件：${file.name}` });
    return new Response(plain, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    await writeAudit({ actorId: user.userId, actorEmail: user.email, action: 'DOWNLOAD_FAILED', fileId: id, detail: `下载失败：${file.name}`, success: false }).catch(() => undefined);
    const message = error instanceof Error ? error.message : '下载失败。';
    return Response.json({ error: message }, { status: 500 });
  }
}
