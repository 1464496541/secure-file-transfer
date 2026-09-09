import { env } from 'cloudflare:workers';
import { validateCryptoConfiguration } from '@/lib/crypto';
import { ensureSchema } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await ensureSchema();
    await Promise.all([
      db.prepare('SELECT 1').first(),
      env.FILES.head('__securevault_healthcheck__'),
      validateCryptoConfiguration(),
    ]);
    return Response.json({
      status: 'ok',
      encryption: 'AES-256-GCM + RSA-OAEP',
      checks: { database: 'ok', objectStorage: 'ok', keyConfiguration: 'ok' },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('SecureVault health check failed.', error);
    return Response.json({ status: 'error', error: '服务配置检查失败。' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
