import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: '密盾传输 · 文件安全传输系统',
  description: '基于 AES-256-GCM 与 RSA-OAEP 混合加密的文件安全传输系统',
  openGraph: {
    title: '密盾传输',
    description: '基于 AES-256-GCM 与 RSA-OAEP 的文件安全传输系统',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '密盾传输',
    description: '基于 AES-256-GCM 与 RSA-OAEP 的文件安全传输系统',
    images: ['/og.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
