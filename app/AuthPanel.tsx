'use client';

import { useState } from 'react';
import { FolderLock, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Mode = 'login' | 'register';

export default function AuthPanel({ oauthError = null }: { oauthError?: string | null }) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(oauthError);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { username, password }
        : { username, password, displayName, email };
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || '操作失败。');
      if (mode === 'register') {
        setMode('login');
        setPassword('');
        setNotice(payload.message || '注册成功，请登录。');
        return;
      }
      window.location.assign('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败。');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_top,#e6f8ff,transparent_48%),#f4f8fa] p-4 sm:p-6">
      <section className="w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(13,64,82,.14)] backdrop-blur sm:p-8">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-white">
          <FolderLock className="size-7" />
        </div>
        <p className="mt-5 text-center text-sm font-medium text-primary">SecureVault</p>
        <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight">密盾传输账号登录</h1>
        <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">
          支持账号密码、微信联网登录和浏览器授权登录，适用于 Chrome、Edge、Firefox、Safari，以及电脑、平板和手机。
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">
          <button type="button" className={`h-10 rounded-lg text-sm font-medium ${mode === 'login' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`} onClick={() => setMode('login')}>登录</button>
          <button type="button" className={`h-10 rounded-lg text-sm font-medium ${mode === 'register' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`} onClick={() => setMode('register')}>注册</button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }} autoComplete={mode === 'login' ? 'on' : 'off'}>
          {mode === 'register' && (
            <div>
              <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium">显示名称</label>
              <Input id="displayName" name="name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-11" />
            </div>
          )}
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium">账号</label>
            <Input id="username" name="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="字母开头，3–32 位" className="h-11" />
          </div>
          {mode === 'register' && (
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">邮箱（可选，用于接收共享）</label>
              <Input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" />
            </div>
          )}
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">密码</label>
            <Input id="password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
          </div>
          {error && <Alert variant="destructive"><AlertTitle>无法继续</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {notice && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><AlertTitle>请登录</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            {mode === 'login' ? '登录' : '创建账号'}
          </Button>
        </form>

        {mode === 'login' && (
          <div className="mt-6 space-y-3">
            <div className="relative text-center text-xs text-muted-foreground">
              <span className="relative z-10 bg-white px-2">或使用联网登录</span>
              <span className="absolute inset-x-0 top-1/2 border-t border-border" />
            </div>
            <button type="button" className="flex h-11 w-full items-center justify-center rounded-xl bg-[#07c160] text-sm font-medium text-white transition hover:opacity-90" onClick={() => { window.location.assign('/api/auth/oauth/wechat/start'); }}>
              微信登录
            </button>
            <button type="button" className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-white text-sm font-medium text-foreground transition hover:bg-muted" onClick={() => { window.location.assign('/api/auth/oauth/github/start'); }}>
              浏览器授权登录
            </button>
            <p className="text-center text-xs leading-5 text-muted-foreground">
              电脑访问微信登录会打开二维码；在微信内打开则直接授权。浏览器授权使用 GitHub OAuth，不限制必须使用谷歌浏览器。
            </p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600" />
          首次部署默认管理员账号 admin，密码见部署说明
        </div>
        <noscript>
          <p className="mt-4 text-center text-sm text-red-600">账号密码登录需要启用 JavaScript；微信与浏览器授权登录可直接点击上方链接。</p>
        </noscript>
      </section>
    </main>
  );
}
