import AuthPanel from './AuthPanel';
import { getAuthUser } from './chatgpt-auth';
import SecureVaultApp from './SecureVaultApp';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAuthUser();
  const params = searchParams ? await searchParams : {};
  const oauthError = typeof params.oauth_error === 'string' ? params.oauth_error : null;
  if (!user) return <AuthPanel oauthError={oauthError} />;
  return (
    <SecureVaultApp
      initialName={user.displayName}
      initialEmail={user.email}
      initialUsername={user.username}
      initialRole={user.role}
    />
  );
}
