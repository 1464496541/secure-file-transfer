import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { encryptFile } from '@/lib/crypto';
import { ensureSchema, writeAudit } from '@/lib/database';

export const dynamic = 'force-dynamic';
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_STORAGE_SIZE = 5 * 1024 * 1024 * 1024;

function normalizeMimeType(value: string) {
  const mimeType = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mimeType)
    ? mimeType.slice(0, 120)
    : 'application/octet-stream';
}

function normalizeFileName(value: string) {
  return value.replace(/\p{Cc}/gu, '_').trim().slice(0, 240) || 'unnamed-file';
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录后上传文件。' }, { status: 401 });

  let uploaded: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get('file');
    if (!(candidate instanceof File)) return Response.json({ error: '请选择需要上传的文件。' }, { status: 400 });
    uploaded = candidate;
    if (uploaded.size === 0) return Response.json({ error: '不能上传空文件。' }, { status: 400 });
    if (uploaded.size > MAX_FILE_SIZE) return Response.json({ error: '演示版单个文件不能超过 15 MB。' }, { status: 413 });

    const db = await ensureSchema();
    const usage = await db.prepare('SELECT COALESCE(SUM(size), 0) AS bytes FROM files WHERE owner_id = ?')
      .bind(user.userId).first<{ bytes: number }>();
    if (Number(usage?.bytes ?? 0) + uploaded.size > MAX_STORAGE_SIZE) {
      return Response.json({ error: '账户存储空间不足，请删除不再需要的文件后重试。' }, { status: 413 });
    }

    const fileName = normalizeFileName(uploaded.name);
    const id = crypto.randomUUID();
    const r2Key = `${user.userId}/${id}.svault`;
    const plain = await uploaded.arrayBuffer();
    const result = await encryptFile(plain, id, user.userId);

    await env.FILES.put(r2Key, result.encrypted, {
      httpMetadata: { contentType: 'application/octet-stream' },
      customMetadata: { algorithm: 'AES-256-GCM+RSA-OAEP', originalSize: String(uploaded.size) },
    });

    try {
      await db.prepare(`INSERT INTO files
        (id, owner_id, owner_email, original_name, mime_type, size, r2_key, iv, wrapped_key, sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id,
          user.userId,
          user.email,
          fileName,
          normalizeMimeType(uploaded.type),
          uploaded.size,
          r2Key,
          result.iv,
          result.wrappedKey,
          result.sha256,
          new Date().toISOString(),
        ).run();
    } catch (error) {
      await env.FILES.delete(r2Key);
      throw error;
    }

    await writeAudit({
      actorId: user.userId,
      actorEmail: user.email,
      action: 'UPLOAD',
      fileId: id,
      detail: `上传并加密文件：${fileName}`,
    });
    return Response.json({ id, message: '文件已加密并安全保存。', sha256: result.sha256 }, { status: 201 });
  } catch (error) {
    await writeAudit({
      actorId: user.userId,
      actorEmail: user.email,
      action: 'UPLOAD_FAILED',
      detail: `上传失败：${uploaded?.name ?? '未知文件'}`,
      success: false,
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : '文件上传失败。';
    return Response.json({ error: message }, { status: 500 });
  }
}
