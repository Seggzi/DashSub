import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SupabaseProvider from '@/providers/SupabaseProvider';
import { Toaster, toast } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DashSub',
  description: 'Fast airtime, data, electricity, cable TV & more',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SupabaseProvider>
          <Toaster position="top-right" richColors />
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}