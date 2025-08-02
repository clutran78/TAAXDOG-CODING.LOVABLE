import type { Metadata } from 'next';
import ClientLayout from '@/shared/client-layout';

// Force dynamic rendering for all authenticated pages
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'TaxReturnPro - Dashboard',
  description: 'Your tax management dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ClientLayout>{children}</ClientLayout>;
}
