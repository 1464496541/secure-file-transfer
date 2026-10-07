import { providerStatus } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ providers: providerStatus() }, { headers: { 'Cache-Control': 'no-store' } });
}
