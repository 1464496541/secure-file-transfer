'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileKey2,
  Files,
  FolderLock,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type View = 'dashboard' | 'files' | 'shared' | 'logs' | 'manual';
type OwnedFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  createdAt: string;
  shareCount: number;
};
type SharedFile = OwnedFile & { ownerEmail: string; expiresAt: string; downloadCount: number };
type OutgoingShare = {
  id: string;
  fileId: string;
  fileName: string;
  recipientEmail: string;
  expiresAt: string;
  downloadCount: number;
};
type AuditLog = { id: string; action: string; detail: string; actorEmail: string; fileId?: string; success: number; createdAt: string };
type DashboardData = {
  user: { displayName: string; email: string };
  stats: { fileCount: number; activeShares: number; storageUsed: number };
  files: OwnedFile[];
  shared: SharedFile[];
  outgoingShares: OutgoingShare[];
  logs: AuditLog[];
};

const actionNames: Record<string, string> = {
  UPLOAD: '加密上传',
  DOWNLOAD: '解密下载',
  SHARE: '授权共享',
  REVOKE_SHARE: '撤销授权',
  DELETE: '删除文件',
  UPLOAD_FAILED: '上传失败',
  DOWNLOAD_FAILED: '下载失败',
  DELETE_FAILED: '删除失败',
};

export default function SecureVaultApp({ initialName, initialEmail, signOutPath }: { initialName: string; initialEmail: string; signOutPath: string }) {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [shareFile, setShareFile] = useState<OwnedFile | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [expiresHours, setExpiresHours] = useState('24');
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    { kind: 'delete-file'; file: OwnedFile } | { kind: 'revoke-share'; share: OutgoingShare } | null
  >(null);
  const [acting, setActing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      const payload = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(payload.error || '数据加载失败。');
      setData(payload);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '数据加载失败。' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/dashboard', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as DashboardData & { error?: string };
        if (!response.ok) throw new Error(payload.error || '数据加载失败。');
        return payload;
      })
      .then((payload) => setData(payload))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setNotice({ type: 'error', message: error instanceof Error ? error.message : '数据加载失败。' });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function uploadSelected(file?: File) {
    if (!file) return;
    if (file.size === 0) {
      setNotice({ type: 'error', message: '不能上传空文件。' });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setNotice({ type: 'error', message: '演示版单个文件不能超过 15 MB。' });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setUploading(true);
    setNotice(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const response = await fetch('/api/files', { method: 'POST', body: form });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || '上传失败。');
      setNotice({ type: 'success', message: payload.message || '文件已安全保存。' });
      await refresh(true);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '上传失败。' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    setActing(true);
    setNotice(null);
    try {
      const endpoint = pendingAction.kind === 'delete-file'
        ? `/api/files/${pendingAction.file.id}`
        : `/api/shares/${pendingAction.share.id}`;
      const response = await fetch(endpoint, { method: 'DELETE' });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || '操作失败。');
      setNotice({ type: 'success', message: payload.message || '操作已完成。' });
      setPendingAction(null);
      await refresh(true);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '操作失败，请稍后重试。' });
      setPendingAction(null);
    } finally {
      setActing(false);
    }
  }

  function openShare(file: OwnedFile) {
    setShareError(null);
    setRecipientEmail('');
    setExpiresHours('24');
    setShareFile(file);
  }

  function closeShare() {
    if (sharing) return;
    setShareFile(null);
    setShareError(null);
  }

  async function createShare() {
    if (!shareFile) return;
    setSharing(true);
    setShareError(null);
    try {
      const response = await fetch(`/api/files/${shareFile.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail, expiresHours: Number(expiresHours) }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || '共享失败。');
      setNotice({ type: 'success', message: payload.message || '共享权限已创建。' });
      setShareFile(null);
      setRecipientEmail('');
      await refresh(true);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : '共享失败。');
    } finally {
      setSharing(false);
    }
  }

  const displayName = data?.user.displayName || initialName;
  const email = data?.user.email || initialEmail;
  const title = ({
    dashboard: '文件安全控制台', files: '我的加密文件', shared: '共享给我的文件', logs: '安全审计日志', manual: '系统使用手册',
  })[activeView];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[248px_1fr]">
        <Sidebar activeView={activeView} setActiveView={setActiveView} storageUsed={data?.stats.storageUsed ?? 0} signOutPath={signOutPath} />
        <section className="min-w-0">
          <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border/80 px-5 py-3 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden"><FolderLock className="size-4" /></div>
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p><p className="truncate text-xs text-muted-foreground">所有操作均经过身份与权限校验</p></div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:inline-flex"><span className="size-1.5 rounded-full bg-emerald-500" /> 系统安全</Badge>
              <div className="hidden text-right sm:block"><p className="max-w-44 truncate text-xs font-medium">{displayName}</p><p className="max-w-44 truncate text-[11px] text-muted-foreground">{email}</p></div>
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">{displayName.slice(0, 1).toUpperCase()}</div>
            </div>
          </header>

          <MobileNav activeView={activeView} setActiveView={setActiveView} />

          <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 sm:py-9">
            {notice && <div aria-live="polite"><Alert className={notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : ''} variant={notice.type === 'error' ? 'destructive' : 'default'}>{notice.type === 'success' ? <CheckCircle2 /> : <XCircle />}<AlertTitle>{notice.type === 'success' ? '操作成功' : '操作未完成'}</AlertTitle><AlertDescription>{notice.message}</AlertDescription></Alert></div>}
            {loading ? <LoadingState /> : (
              <>
                {activeView === 'dashboard' && <Dashboard data={data} uploading={uploading} onUpload={() => inputRef.current?.click()} onShare={openShare} onDelete={(file) => setPendingAction({ kind: 'delete-file', file })} />}
                {activeView === 'files' && <FileLibrary files={data?.files ?? []} outgoingShares={data?.outgoingShares ?? []} uploading={uploading} onUpload={() => inputRef.current?.click()} onShare={openShare} onDelete={(file) => setPendingAction({ kind: 'delete-file', file })} onRevoke={(share) => setPendingAction({ kind: 'revoke-share', share })} />}
                {activeView === 'shared' && <SharedLibrary files={data?.shared ?? []} />}
                {activeView === 'logs' && <AuditLibrary logs={data?.logs ?? []} />}
                {activeView === 'manual' && <ManualView />}
              </>
            )}
          </div>
        </section>
      </div>

      <input ref={inputRef} type="file" className="sr-only" onChange={(event) => void uploadSelected(event.target.files?.[0])} />
      <Dialog open={Boolean(shareFile)} onOpenChange={(open) => !open && closeShare()}>
        <DialogContent>
          <DialogHeader><DialogTitle>共享加密文件</DialogTitle><DialogDescription>指定收件人的登录邮箱和访问有效期。若网站采用私密发布，还需由管理员把收件人加入网站访问名单。</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            {shareFile && <div className="rounded-xl border border-border bg-muted/45 px-4 py-3"><p className="text-xs text-muted-foreground">当前文件</p><p className="mt-1 truncate text-sm font-medium">{shareFile.name}</p></div>}
            <div><label htmlFor="recipient" className="mb-1.5 block text-sm font-medium">收件人邮箱</label><Input id="recipient" type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="name@example.com" className="h-10" /></div>
            <div><label htmlFor="expires" className="mb-1.5 block text-sm font-medium">有效期（小时）</label><Input id="expires" type="number" min="1" max="168" value={expiresHours} onChange={(event) => setExpiresHours(event.target.value)} className="h-10" /></div>
            {shareError && <Alert variant="destructive"><XCircle /><AlertTitle>无法创建共享</AlertTitle><AlertDescription>{shareError}</AlertDescription></Alert>}
          </div>
          <DialogFooter><Button variant="outline" disabled={sharing} onClick={closeShare}>取消</Button><Button disabled={sharing || !recipientEmail.trim()} onClick={() => void createShare()}>{sharing && <LoaderCircle className="animate-spin" />}确认共享</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && !acting && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.kind === 'delete-file' ? '确认删除文件？' : '确认撤销共享？'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === 'delete-file'
                ? `“${pendingAction.file.name}”的密文与全部共享权限都会被删除，且无法恢复。`
                : `撤销后，${pendingAction?.share.recipientEmail ?? '该收件人'} 将立即无法继续下载此文件。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={acting} onClick={() => void confirmPendingAction()}>
              {acting && <LoaderCircle className="animate-spin" />}{pendingAction?.kind === 'delete-file' ? '确认删除' : '撤销授权'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Sidebar({ activeView, setActiveView, storageUsed, signOutPath }: { activeView: View; setActiveView: (view: View) => void; storageUsed: number; signOutPath: string }) {
  const maxStorage = 5 * 1024 * 1024 * 1024;
  const percent = Math.min(100, Math.round(storageUsed / maxStorage * 100));
  return <aside className="hidden border-r border-border/80 bg-sidebar px-5 py-6 lg:flex lg:flex-col"><Brand /><nav className="mt-10 space-y-1" aria-label="主导航"><NavButton icon={<LayoutDashboard />} label="控制台" view="dashboard" activeView={activeView} setActiveView={setActiveView} /><NavButton icon={<Files />} label="我的文件" view="files" activeView={activeView} setActiveView={setActiveView} /><NavButton icon={<Send />} label="共享给我" view="shared" activeView={activeView} setActiveView={setActiveView} /><NavButton icon={<Activity />} label="安全日志" view="logs" activeView={activeView} setActiveView={setActiveView} /><NavButton icon={<Menu />} label="使用手册" view="manual" activeView={activeView} setActiveView={setActiveView} /></nav><div className="mt-auto rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">存储空间</span><span className="text-xs text-muted-foreground">{percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">已使用 {formatSize(storageUsed)} / 5 GB</p></div><a href={signOutPath} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"><LogOut className="size-4" /> 退出登录</a></aside>;
}

function Brand() { return <div className="flex items-center gap-3 px-2"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><FolderLock className="size-5" /></div><div><p className="font-semibold tracking-tight">密盾传输</p><p className="text-xs text-muted-foreground">SecureVault</p></div></div>; }

function NavButton({ icon, label, view, activeView, setActiveView }: { icon: React.ReactNode; label: string; view: View; activeView: View; setActiveView: (view: View) => void }) { const active = view === activeView; return <button aria-current={active ? 'page' : undefined} onClick={() => setActiveView(view)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><span className="[&_svg]:size-4">{icon}</span>{label}</button>; }

function MobileNav({ activeView, setActiveView }: { activeView: View; setActiveView: (view: View) => void }) { const items: Array<[View, string]> = [['dashboard', '控制台'], ['files', '我的文件'], ['shared', '共享'], ['logs', '日志'], ['manual', '手册']]; return <nav aria-label="移动端主导航" className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:hidden">{items.map(([view, label]) => <button key={view} aria-current={activeView === view ? 'page' : undefined} onClick={() => setActiveView(view)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${activeView === view ? 'bg-primary text-white' : 'text-muted-foreground'}`}>{label}</button>)}</nav>; }

function Dashboard({ data, uploading, onUpload, onShare, onDelete }: { data: DashboardData | null; uploading: boolean; onUpload: () => void; onShare: (file: OwnedFile) => void; onDelete: (file: OwnedFile) => void }) {
  return <><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-medium text-primary">安全文件工作台</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">开始一次安全传输</h1><p className="mt-2 text-sm text-muted-foreground">上传后自动完成内容加密、密钥封装与完整性摘要。</p></div><UploadButton uploading={uploading} onClick={onUpload} /></div><div className="grid gap-4 md:grid-cols-3"><StatCard icon={<Files />} label="安全文件" value={String(data?.stats.fileCount ?? 0)} note="仅文件所有者可管理" /><StatCard icon={<Send />} label="有效共享" value={String(data?.stats.activeShares ?? 0)} note="支持最长 7 天有效期" /><StatCard icon={<ShieldCheck />} label="完整性保护" value="已启用" note="AES-GCM + SHA-256 双重验证" /></div><div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><FilePanel title="最近文件" subtitle="最近上传的加密文件" files={(data?.files ?? []).slice(0, 5)} onShare={onShare} onDelete={onDelete} /><SecurityCard /></div></>;
}

function FileLibrary({ files, outgoingShares, uploading, onUpload, onShare, onDelete, onRevoke }: { files: OwnedFile[]; outgoingShares: OutgoingShare[]; uploading: boolean; onUpload: () => void; onShare: (file: OwnedFile) => void; onDelete: (file: OwnedFile) => void; onRevoke: (share: OutgoingShare) => void }) { return <><PageHeading eyebrow="加密存储" title="我的加密文件" description="原始文件不会落盘，存储中仅保留 AES-GCM 密文。" action={<UploadButton uploading={uploading} onClick={onUpload} />} /><FilePanel title={`全部文件 · ${files.length}`} subtitle="点击下载时由服务端鉴权、解密并校验" files={files} onShare={onShare} onDelete={onDelete} /><OutgoingSharesPanel shares={outgoingShares} onRevoke={onRevoke} /></>; }

function SharedLibrary({ files }: { files: SharedFile[] }) { return <><PageHeading eyebrow="受控共享" title="共享给我的文件" description="只有收件邮箱匹配且授权未过期时才能下载。" /><section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">{files.length ? <div className="divide-y divide-border">{files.map((file) => <div key={file.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_170px_130px_auto] sm:items-center"><FileIdentity file={file} /><span className="truncate text-xs text-muted-foreground">来自 {file.ownerEmail}</span><span className="text-xs text-muted-foreground">至 {formatDate(file.expiresAt)}</span><a className={buttonVariants({ variant: 'outline' })} href={`/api/files/${file.id}/download`}><Download />下载</a></div>)}</div> : <EmptyState title="暂时没有收到文件" description="请让文件所有者使用你的登录邮箱创建共享。" />}</section></>; }

function AuditLibrary({ logs }: { logs: AuditLog[] }) { return <><PageHeading eyebrow="可追溯安全" title="安全审计日志" description="上传、共享、下载、撤销、删除与失败操作都会被记录。" /><section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">{logs.length ? <div className="divide-y divide-border">{logs.map((log) => <div key={log.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[120px_1fr_150px] sm:items-center"><Badge variant={log.success ? 'secondary' : 'destructive'} className={log.success ? 'bg-sky-50 text-sky-700' : ''}>{actionNames[log.action] ?? log.action}</Badge><div className="flex items-start gap-2 text-sm">{log.success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />}<div><p>{log.detail}</p><p className="mt-1 text-xs text-muted-foreground">操作账号：{log.actorEmail}</p></div></div><span className="text-xs text-muted-foreground sm:text-right">{formatDate(log.createdAt)}</span></div>)}</div> : <EmptyState title="暂无操作记录" description="首次上传文件后，审计日志会显示在这里。" />}</section></>; }

function OutgoingSharesPanel({ shares, onRevoke }: { shares: OutgoingShare[]; onRevoke: (share: OutgoingShare) => void }) {
  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold">当前有效授权 · {shares.length}</h2><p className="text-xs text-muted-foreground">查看收件人、到期时间和下载次数，可随时提前撤销</p></div>{shares.length ? <div className="divide-y divide-border">{shares.map((share) => <div key={share.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_220px_160px_auto] sm:items-center"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UserRoundCheck className="size-5" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{share.fileName}</p><p className="truncate text-xs text-muted-foreground">已下载 {share.downloadCount} 次</p></div></div><span className="truncate text-sm text-muted-foreground">{share.recipientEmail}</span><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />至 {formatDate(share.expiresAt)}</span><Button variant="outline" size="sm" onClick={() => onRevoke(share)}>撤销</Button></div>)}</div> : <EmptyState title="暂无有效授权" description="为文件创建共享后，可在这里统一管理。" />}</section>;
}

function ManualView() { return <><PageHeading eyebrow="快速上手" title="系统使用手册" description="从登录到安全共享，完整操作只需几步。" action={<a className={buttonVariants({ variant: 'outline' })} href="/downloads/密盾传输系统使用手册.docx" download><Download />下载 Word 手册</a>} /><div className="grid gap-5 md:grid-cols-2"><GuideCard number="01" title="登录系统" text="使用 ChatGPT 账号登录。系统以稳定用户标识和邮箱进行身份与共享权限校验。" /><GuideCard number="02" title="加密上传" text="点击“上传文件”，选择不超过 15 MB 的文件。等待提示“文件已加密并安全保存”。" /><GuideCard number="03" title="受控共享" text="填写对方登录邮箱并设置有效期；可在“当前有效授权”查看下载次数或随时撤销。" /><GuideCard number="04" title="下载校验" text="点击“下载”后，系统自动解封密钥、解密文件并核对 SHA-256；校验失败时拒绝返回文件。" /></div><section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="font-semibold">注意事项</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>请勿把 RSA 私钥写入源代码或发送给他人。</li><li>演示版限制单文件 15 MB、单账户总空间 5 GB。</li><li>共享必须填写对方实际登录邮箱；私密网站还要将对方加入访问名单。</li><li>撤销授权会立即阻止收件人继续下载，并写入审计日志。</li><li>删除文件会同时清理密文和共享权限，此操作不可撤销。</li></ul></section></>; }

function FilePanel({ title, subtitle, files, onShare, onDelete }: { title: string; subtitle: string; files: OwnedFile[]; onShare: (file: OwnedFile) => void; onDelete: (file: OwnedFile) => void }) { return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div>{files.length ? <div className="divide-y divide-border">{files.map((file) => <div key={file.id} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 transition hover:bg-muted/45 sm:grid-cols-[1fr_90px_120px_auto]"><FileIdentity file={file} /><span className="hidden text-xs text-muted-foreground sm:block">{formatDate(file.createdAt)}</span><Badge variant="secondary" className={`hidden sm:inline-flex ${file.shareCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{file.shareCount > 0 ? <Share2 /> : <LockKeyhole />}{file.shareCount > 0 ? `${file.shareCount} 个授权` : '仅自己'}</Badge><div className="flex items-center justify-end gap-1"><a className={buttonVariants({ variant: 'ghost', size: 'icon' })} href={`/api/files/${file.id}/download`} title="下载" aria-label={`下载 ${file.name}`}><Download /></a><Button size="icon" variant="ghost" title="共享" aria-label={`共享 ${file.name}`} onClick={() => onShare(file)}><Share2 /></Button><Button size="icon" variant="destructive" title="删除" aria-label={`删除 ${file.name}`} onClick={() => onDelete(file)}><Trash2 /></Button></div></div>)}</div> : <EmptyState title="还没有加密文件" description="上传一个文件开始体验混合加密传输。" />}</section>; }

function FileIdentity({ file }: { file: OwnedFile }) { return <div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-primary"><FileCheck2 className="size-5" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{file.name}</p><p className="truncate text-xs text-muted-foreground">{formatSize(Number(file.size))} · SHA-256 {file.sha256.slice(0, 10)}…</p></div></div>; }

function SecurityCard() { return <section className="rounded-2xl bg-[linear-gradient(145deg,#0b2b3c,#0c4a5d)] p-6 text-white shadow-sm"><div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-xl bg-white/10"><KeyRound className="size-5 text-cyan-200" /></div><Badge className="bg-white/10 text-cyan-100">混合加密</Badge></div><h2 className="mt-6 text-xl font-semibold">双重密码保护</h2><p className="mt-2 text-sm leading-6 text-slate-300">文件内容与密钥分别加密，即使只获得存储密文，也无法直接还原原始文件。</p><div className="mt-5 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs"><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="rounded-lg bg-white/10 px-2 py-2">原始文件</span><span className="text-cyan-300">→</span><span className="rounded-lg bg-cyan-300/15 px-2 py-2 text-cyan-100">AES 密文</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="rounded-lg bg-white/10 px-2 py-2">随机密钥</span><span className="text-cyan-300">→</span><span className="rounded-lg bg-cyan-300/15 px-2 py-2 text-cyan-100">RSA 封装</span></div></div><div className="mt-5 space-y-3 border-t border-white/10 pt-5"><SecurityLine icon={<LockKeyhole />} label="AES-256-GCM" detail="内容加密与认证标签" /><SecurityLine icon={<FileKey2 />} label="RSA-OAEP / SHA-256" detail="随机文件密钥封装" /><SecurityLine icon={<ShieldCheck />} label="SHA-256" detail="下载前完整性复核" /></div></section>; }

function SecurityLine({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) { return <div className="flex items-center gap-3"><span className="text-cyan-200 [&_svg]:size-4">{icon}</span><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-slate-400">{detail}</p></div></div>; }

function StatCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) { return <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p></div><div className="grid size-10 place-items-center rounded-xl bg-sky-50 text-primary [&_svg]:size-5">{icon}</div></div><p className="mt-4 text-xs text-muted-foreground">{note}</p></article>; }

function UploadButton({ uploading, onClick }: { uploading: boolean; onClick: () => void }) { return <Button size="lg" className="h-10 rounded-xl px-4" disabled={uploading} onClick={onClick}>{uploading ? <LoaderCircle className="animate-spin" /> : <UploadCloud />}{uploading ? '正在加密…' : '上传文件'}</Button>; }

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-medium text-primary">{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>{action}</div>; }

function GuideCard({ number, title, text }: { number: string; title: string; text: string }) { return <article className="rounded-2xl border border-border bg-card p-6 shadow-sm"><span className="text-sm font-semibold text-primary">步骤 {number}</span><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></article>; }

function EmptyState({ title, description }: { title: string; description: string }) { return <div className="grid min-h-52 place-items-center p-8 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><FolderLock className="size-5" /></div><p className="mt-4 font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>; }

function LoadingState() { return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">正在读取加密文件信息…</p></div></div>; }

function formatSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`; return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`; }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
