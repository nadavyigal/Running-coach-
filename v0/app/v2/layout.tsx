import type { Metadata, Viewport } from 'next';
import { Syne, Outfit, DM_Mono } from 'next/font/google';
import './v2.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RunSmart v2 — iOS Preview',
  description: 'New Forest Intelligence design — preview before swap',
};

export const viewport: Viewport = {
  themeColor: '#070E09',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${syne.variable} ${outfit.variable} ${dmMono.variable} rs-v2-root`}>
      {children}
    </div>
  );
}
