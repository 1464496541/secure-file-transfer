import { env } from 'cloudflare:workers';
import { hashPassword } from '@/lib/password';

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
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS login_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      login_time TEXT NOT NULL,
      login_ip TEXT,
      user_agent TEXT,
      browser_name TEXT,
      browser_version TEXT,
      operating_system TEXT,
      device_type TEXT,
      login_method TEXT,
      login_status TEXT NOT NULL,
      failure_reason TEXT,
      session_id TEXT,
      logout_time TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_login_logs_time ON login_logs(login_time)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_login_logs_username_time ON login_logs(username, login_time)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_login_logs_ip_time ON login_logs(login_ip, login_time)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_login_logs_status_time ON login_logs(login_status, login_time)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      display_name TEXT,
      email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_provider_user ON oauth_accounts(provider, provider_user_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at)'),
  ]);

  for (const sql of [
    'ALTER TABLE login_logs ADD COLUMN device_type TEXT',
    'ALTER TABLE login_logs ADD COLUMN login_method TEXT',
  ]) {
    try {
      await env.DB.prepare(sql).run();
    } catch {
      // 列已存在时 SQLite 会报 duplicate column，忽略即可。
    }
  }

  await seedDefaultAdmin();
  await env.DB.prepare('PRAGMA optimize').run();
  schemaReady = true;
  return env.DB;
}

async function seedDefaultAdmin() {
  const existing = await env.DB.prepare('SELECT id FROM users LIMIT 1').first();
  if (existing) return;
  const now = new Date().toISOString();
  const password = env.ADMIN_INITIAL_PASSWORD || 'SecureVault@2026';
  await env.DB.prepare(`INSERT INTO users
      (id, username, password_hash, display_name, email, role, status, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, 'admin', 'active', ?, ?, NULL)`)
    .bind(crypto.randomUUID(), 'admin', await hashPassword(password), '系统管理员', 'admin@localhost', now, now)
    .run();
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
  await prepareAudit(db, input).run();
}

export function prepareAudit(db: typeof env.DB, input: {
  actorId: string;
  actorEmail: string;
  action: string;
  fileId?: string;
  detail: string;
  success?: boolean;
}) {
  return db.prepare(`INSERT INTO audit_logs
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
    );
}
