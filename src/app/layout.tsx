import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { DarkModeProvider } from '@/providers/dark-mode-provider';
import { Providers } from './providers';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TaxReturnPro - Australian Tax Management',
  description: 'Professional tax management and financial tracking for Australians',
  keywords: 'tax, australia, finance, accounting, ATO',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <DarkModeProvider>{children}</DarkModeProvider>
        </Providers>
      </body>
    </html>
  );
}
