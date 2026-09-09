import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureSchema } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录后使用。' }, { status: 401 });

  const db = await ensureSchema();
  const now = new Date().toISOString();
  const [owned, shared, outgoingShares, logs, totals] = await Promise.all([
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
    db.prepare(`SELECT s.id, s.file_id AS fileId, f.original_name AS fileName,
      s.recipient_email AS recipientEmail, s.expires_at AS expiresAt,
      s.download_count AS downloadCount
      FROM shares s JOIN files f ON f.id = s.file_id
      WHERE s.owner_id = ? AND s.expires_at > ?
      ORDER BY s.created_at DESC LIMIT 100`)
      .bind(user.userId, now).all(),
    db.prepare(`SELECT id, action, detail, actor_email AS actorEmail,
      file_id AS fileId, success, created_at AS createdAt
      FROM audit_logs
      WHERE actor_id = ? OR file_id IN (SELECT id FROM files WHERE owner_id = ?)
      ORDER BY created_at DESC LIMIT 50`)
      .bind(user.userId, user.userId).all(),
    db.prepare(`SELECT
      COUNT(*) AS fileCount,
      COALESCE(SUM(size), 0) AS storageUsed,
      (SELECT COUNT(*) FROM shares WHERE owner_id = ? AND expires_at > ?) AS activeShares
      FROM files WHERE owner_id = ?`)
      .bind(user.userId, now, user.userId).first<{ fileCount: number; storageUsed: number; activeShares: number }>(),
  ]);

  const files = owned.results ?? [];

  return Response.json({
    user: { displayName: user.displayName, email: user.email },
    stats: {
      fileCount: Number(totals?.fileCount ?? 0),
      activeShares: Number(totals?.activeShares ?? 0),
      storageUsed: Number(totals?.storageUsed ?? 0),
    },
    files,
    shared: shared.results ?? [],
    outgoingShares: outgoingShares.results ?? [],
    logs: logs.results ?? [],
  }, { headers: { 'Cache-Control': 'no-store' } });
}
