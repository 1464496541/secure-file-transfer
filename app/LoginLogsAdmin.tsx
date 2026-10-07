'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type LoginLog = {
  id: string;
  user_id: string | null;
  username: string;
  login_time: string;
  login_ip: string | null;
  user_agent: string | null;
  browser_name: string | null;
  browser_version: string | null;
  operating_system: string | null;
  device_type: string | null;
  login_method: string | null;
  login_status: 'success' | 'failure';
  failure_reason: string | null;
  session_id: string | null;
  logout_time: string | null;
};

type Query = { username: string; ip: string; status: string; from: string; to: string; page: number };

const failureLabels: Record<string, string> = {
  bad_password: '密码错误',
  user_not_found: '账号不存在',
  disabled: '账号停用',
  rate_limited: '尝试次数过多',
  oauth_denied: '取消授权',
  oauth_unconfigured: '未配置联网登录',
  oauth_invalid_state: '授权状态无效',
  oauth_failed: '联网登录失败',
};

const methodLabels: Record<string, string> = {
  password: '账号密码',
  wechat: '微信登录',
  github: '浏览器授权',
};

export default function LoginLogsAdmin() {
  const [username, setUsername] = useState('');
  const [ip, setIp] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState<Query>({ username: '', ip: '', status: '', from: '', to: '', page: 1 });
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<LoginLog | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(query.page), pageSize: '20' });
    if (query.username) params.set('username', query.username);
    if (query.ip) params.set('ip', query.ip);
    if (query.status) params.set('status', query.status);
    if (query.from) params.set('from', new Date(query.from).toISOString());
    if (query.to) params.set('to', new Date(query.to).toISOString());

    fetch(`/api/admin/login-logs?${params}`, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { error?: string; items?: LoginLog[]; total?: number; totalPages?: number };
        if (!response.ok) throw new Error(payload.error || '查询失败。');
        return payload;
      })
      .then((payload) => {
        setItems(payload.items ?? []);
        setTotal(payload.total ?? 0);
        setTotalPages(payload.totalPages ?? 1);
        setError(null);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : '查询失败。');
        setLoading(false);
      });

    return () => controller.abort();
  }, [query]);

  async function openDetail(id: string) {
    const response = await fetch(`/api/admin/login-logs/${id}`, { cache: 'no-store', credentials: 'same-origin' });
    const payload = await response.json() as { item?: LoginLog; error?: string };
    if (response.ok && payload.item) setDetail(payload.item);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">管理员审计</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">登录记录</h1>
        <p className="mt-2 text-sm text-muted-foreground">按账号、时间、IP 和登录状态筛选，支持分页和详情。</p>
      </div>

      <form
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setQuery({ username: username.trim(), ip: ip.trim(), status, from, to, page: 1 });
        }}
      >
        <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="账号" aria-label="账号" />
        <Input value={ip} onChange={(event) => setIp(event.target.value)} placeholder="IP 地址" aria-label="IP 地址" />
        <select className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="登录状态">
          <option value="">全部状态</option>
          <option value="success">成功</option>
          <option value="failure">失败</option>
        </select>
        <Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="开始时间" />
        <Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} aria-label="结束时间" />
        <Button type="submit"><Search />查询</Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">共 {total} 条记录，第 {query.page} / {totalPages} 页</p>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>
        ) : (
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">账号</th>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">浏览器</th>
                <th className="px-4 py-3 font-medium">方式</th>
                <th className="px-4 py-3 font-medium">结果</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{item.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.login_time)}</td>
                  <td className="px-4 py-3">{item.login_ip || '-'}</td>
                  <td className="px-4 py-3">{item.browser_name} {item.browser_version}</td>
                  <td className="px-4 py-3">{methodLabels[item.login_method || 'password'] || item.login_method || '账号密码'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={item.login_status === 'success' ? 'secondary' : 'destructive'}>
                      {item.login_status === 'success' ? '成功' : '失败'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => void openDetail(item.id)}>详情</Button>
                  </td>
                </tr>
              )) : (
                <tr><td className="px-4 py-10 text-center text-muted-foreground" colSpan={7}>没有符合条件的登录记录。</td></tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={query.page <= 1 || loading} onClick={() => { setLoading(true); setQuery((current) => ({ ...current, page: current.page - 1 })); }}>上一页</Button>
        <Button variant="outline" disabled={query.page >= totalPages || loading} onClick={() => { setLoading(true); setQuery((current) => ({ ...current, page: current.page + 1 })); }}>下一页</Button>
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>登录详情</DialogTitle>
            <DialogDescription>完整记录账号、环境与会话信息。</DialogDescription>
          </DialogHeader>
          {detail && (
            <dl className="grid gap-3 text-sm">
              <Detail label="记录编号" value={detail.id} />
              <Detail label="账号" value={detail.username} />
              <Detail label="用户编号" value={detail.user_id || '未绑定'} />
              <Detail label="登录时间" value={formatDateTime(detail.login_time)} />
              <Detail label="退出时间" value={detail.logout_time ? formatDateTime(detail.logout_time) : '仍在会话中或未记录'} />
              <Detail label="IP 地址" value={detail.login_ip || '-'} />
              <Detail label="浏览器" value={`${detail.browser_name ?? ''} ${detail.browser_version ?? ''}`.trim() || '-'} />
              <Detail label="登录方式" value={methodLabels[detail.login_method || 'password'] || detail.login_method || '账号密码'} />
              <Detail label="操作系统" value={detail.operating_system || '-'} />
              <Detail label="设备类型" value={deviceLabel(detail.device_type)} />
              <Detail label="登录结果" value={detail.login_status === 'success' ? '成功' : `失败${detail.failure_reason ? `（${failureLabels[detail.failure_reason] || detail.failure_reason}）` : ''}`} />
              <Detail label="会话编号" value={detail.session_id || '-'} />
              <Detail label="User-Agent" value={detail.user_agent || '-'} />
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all">{value}</dd>
    </div>
  );
}

function deviceLabel(value: string | null) {
  if (value === 'mobile') return '手机';
  if (value === 'tablet') return '平板';
  if (value === 'desktop') return '电脑';
  return '未知';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(value));
}
