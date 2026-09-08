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
