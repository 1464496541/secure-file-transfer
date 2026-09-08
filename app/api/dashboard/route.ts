import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureSchema } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录后使用。' }, { status: 401 });

  const db = await ensureSchema();
  const now = new Date().toISOString();
  const [owned, shared, logs] = await Promise.all([
    db.prepare(`SELECT f.id, f.original_name AS name, f.mime_type AS mimeType,
      f.size, f.sha256, f.created_at AS createdAt,
      (SELECT COUNT(*) FROM shares s WHERE s.file_id = f.id AND s.expires_at > ?) AS shareCount
      FROM files f WHERE f.owner_id = ? ORDER BY f.created_at DESC LIMIT 100`)
      .bind(now, user.userId).all(),
    db.prepare(`SELECT f.id, f.original_name AS name, f.mime_type AS mimeType,
      f.size, f.sha256, f.created_at AS createdAt, f.owner_email AS ownerEmail,
      s.expires_at AS expiresAt, s.download_count AS downloadCount
      FROM shares s JOIN files f ON f.id = s.file_id
      WHERE lower(s.recipient_email) = lower(?) AND s.expires_at > ?
      ORDER BY s.created_at DESC LIMIT 100`)
      .bind(user.email, now).all(),
    db.prepare(`SELECT id, action, detail, file_id AS fileId, success, created_at AS createdAt
      FROM audit_logs WHERE actor_id = ? ORDER BY created_at DESC LIMIT 50`)
      .bind(user.userId).all(),
  ]);

  const files = owned.results ?? [];
  const storageUsed = files.reduce((total, file) => total + Number(file.size ?? 0), 0);
  const activeShares = files.reduce((total, file) => total + Number(file.shareCount ?? 0), 0);

  return Response.json({
    user: { displayName: user.displayName, email: user.email },
    stats: { fileCount: files.length, activeShares, storageUsed },
    files,
    shared: shared.results ?? [],
    logs: logs.results ?? [],
  });
}
