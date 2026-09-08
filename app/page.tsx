import { FolderLock, ShieldCheck } from 'lucide-react';
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from './chatgpt-auth';
import SecureVaultApp from './SecureVaultApp';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#e6f8ff,transparent_48%),#f4f8fa] p-6">
        <section className="w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-8 text-center shadow-[0_24px_80px_rgba(13,64,82,.14)] backdrop-blur">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-white"><FolderLock className="size-7" /></div>
          <p className="mt-5 text-sm font-medium text-primary">SecureVault</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">登录密盾传输</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">登录后才能访问个人加密文件、收到的共享以及安全审计日志。</p>
          <a href={chatGPTSignInPath('/')} target="_top" className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white transition hover:opacity-90">使用 ChatGPT 账号登录</a>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-emerald-600" />身份验证由平台安全完成</div>
        </section>
      </main>
    );
  }

  return <SecureVaultApp initialName={user.displayName} initialEmail={user.email} signOutPath={chatGPTSignOutPath('/')} />;
}
