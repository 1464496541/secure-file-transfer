import { getAuthUser } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: '未登录。' }, { status: 401 });
  return Response.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
