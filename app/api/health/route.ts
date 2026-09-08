import { ensureSchema } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await ensureSchema();
    await db.prepare('SELECT 1').first();
    return Response.json({ status: 'ok', encryption: 'AES-256-GCM + RSA-OAEP', storage: 'D1 + R2' });
  } catch (error) {
    return Response.json({ status: 'error', error: error instanceof Error ? error.message : 'unknown' }, { status: 500 });
  }
}
