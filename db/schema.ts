import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    ownerEmail: text('owner_email').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    r2Key: text('r2_key').notNull(),
    iv: text('iv').notNull(),
    wrappedKey: text('wrapped_key').notNull(),
    sha256: text('sha256').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_files_owner_created').on(table.ownerId, table.createdAt),
    uniqueIndex('idx_files_r2_key').on(table.r2Key),
  ],
);

export const shares = sqliteTable(
  'shares',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),
    ownerId: text('owner_id').notNull(),
    recipientEmail: text('recipient_email').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    downloadCount: integer('download_count').notNull().default(0),
  },
  (table) => [
    uniqueIndex('idx_shares_file_recipient').on(table.fileId, table.recipientEmail),
    index('idx_shares_recipient_expiry').on(table.recipientEmail, table.expiresAt),
  ],
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').notNull(),
    actorEmail: text('actor_email').notNull(),
    action: text('action').notNull(),
    fileId: text('file_id'),
    detail: text('detail').notNull(),
    success: integer('success', { mode: 'boolean' }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_audit_actor_created').on(table.actorId, table.createdAt)],
);

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    email: text('email'),
    role: text('role').notNull().default('user'),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastLoginAt: text('last_login_at'),
  },
  (table) => [uniqueIndex('idx_users_username').on(table.username), index('idx_users_email').on(table.email)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
  },
  (table) => [index('idx_sessions_user').on(table.userId), index('idx_sessions_expires').on(table.expiresAt)],
);

export const loginLogs = sqliteTable(
  'login_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    username: text('username').notNull(),
    loginTime: text('login_time').notNull(),
    loginIp: text('login_ip'),
    userAgent: text('user_agent'),
    browserName: text('browser_name'),
    browserVersion: text('browser_version'),
    operatingSystem: text('operating_system'),
    deviceType: text('device_type'),
    loginMethod: text('login_method'),
    loginStatus: text('login_status').notNull(),
    failureReason: text('failure_reason'),
    sessionId: text('session_id'),
    logoutTime: text('logout_time'),
  },
  (table) => [
    index('idx_login_logs_time').on(table.loginTime),
    index('idx_login_logs_username_time').on(table.username, table.loginTime),
    index('idx_login_logs_ip_time').on(table.loginIp, table.loginTime),
    index('idx_login_logs_status_time').on(table.loginStatus, table.loginTime),
  ],
);

export const oauthAccounts = sqliteTable(
  'oauth_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    displayName: text('display_name'),
    email: text('email'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_oauth_provider_user').on(table.provider, table.providerUserId),
    index('idx_oauth_user').on(table.userId),
  ],
);

export const oauthStates = sqliteTable(
  'oauth_states',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_oauth_states_expires').on(table.expiresAt)],
);
