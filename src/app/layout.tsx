import '@/lib/env';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Yanki 24 – Gestión de Caja',
  description: 'Sistema de gestión de caja para kiosco 24 horas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="light">
      <body className={inter.className} style={{ backgroundColor: '#f8fafc' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
