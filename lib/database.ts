import { env } from 'cloudflare:workers';

let schemaReady = false;

/**
 * 运行时幂等初始化让本地演示和首次部署都能直接使用。
 * 正式迁移文件仍由 Drizzle 生成，便于在论文中说明数据库演进过程。
 */
export async function ensureSchema() {
  if (schemaReady) return env.DB;

  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      r2_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      wrapped_key TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_files_owner_created ON files(owner_id, created_at)'),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_files_r2_key ON files(r2_key)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      download_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_file_recipient ON shares(file_id, recipient_email)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_shares_recipient_expiry ON shares(recipient_email, expires_at)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      file_id TEXT,
      detail TEXT NOT NULL,
      success INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs(actor_id, created_at)'),
  ]);

  await env.DB.prepare('PRAGMA optimize').run();
  schemaReady = true;
  return env.DB;
}

export async function writeAudit(input: {
  actorId: string;
  actorEmail: string;
  action: string;
  fileId?: string;
  detail: string;
  success?: boolean;
}) {
  const db = await ensureSchema();
  await db
    .prepare(`INSERT INTO audit_logs
      (id, actor_id, actor_email, action, file_id, detail, success, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      input.actorId,
      input.actorEmail,
      input.action,
      input.fileId ?? null,
      input.detail,
      input.success === false ? 0 : 1,
      new Date().toISOString(),
    )
    .run();
}
