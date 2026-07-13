import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import AppLayout from '@/components/AppLayout';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space',
  subsets: ['latin'],
  display: 'swap',
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

const absoluteUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

const siteTitle = 'GoldQuant AI';
const siteDescription =
  'Dashboard quản trị rủi ro multi-account XAUUSD · AI Advisor realtime · lịch kinh tế Forex Factory · Monte Carlo · equity & capital tracking. Solo Risk Manager Pro.';

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl),
  title: {
    default: `${siteTitle} — Risk Manager Dashboard`,
    template: `%s · ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  authors: [{ name: 'GoldQuant AI' }],
  creator: 'GoldQuant AI',
  keywords: [
    'GoldQuant AI',
    'XAUUSD',
    'gold trading',
    'risk management',
    'MT5',
    'prop firm',
    'Monte Carlo',
    'Forex Factory',
    'AI trading advisor',
  ],
  // Favicon: Next tự lấy src/app/icon.png + apple-icon.png (PNG RGBA)
  // Không dùng favicon.ico tự ghép (Next crash: PNG not RGBA)
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    shortcut: ['/favicon-32.png'],
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: absoluteUrl,
    siteName: siteTitle,
    title: `${siteTitle} — XAUUSD Multi-Account Risk Manager`,
    description: siteDescription,
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'GoldQuant AI — Risk Manager Dashboard preview',
      },
      {
        url: '/og-dashboard.png',
        width: 1200,
        height: 630,
        alt: 'GoldQuant AI dashboard overview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteTitle} — Risk Manager Pro`,
    description: siteDescription,
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  category: 'finance',
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050507' },
    { media: '(prefers-color-scheme: light)', color: '#050507' },
  ],
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-dark-bg text-dark-text-light font-[family-name:var(--font-inter)]">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
