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
  title: 'Truth Bible · Digital Edition',
  description:
    "A tactile digital edition of St Joseph's Church Truth Bible 2026.",
  openGraph: {
    title: 'Truth Bible · Digital Edition',
    description:
      "Explore St Joseph's Church Truth Bible 2026 in a responsive page-turning reader.",
    type: 'website',
    images: [
      {
        url: '/social-preview.png',
        width: 1200,
        height: 630,
        alt: 'Truth Bible — Digital Edition · 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Truth Bible · Digital Edition',
    description:
      "Explore St Joseph's Church Truth Bible 2026 in a responsive page-turning reader.",
    images: ['/social-preview.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
