import type { Metadata, Viewport } from 'next';
import { Syne, Lato } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const syne = Syne({ subsets: ['latin'], variable: '--font-display', weight: ['400','600','700','800'] });
const lato = Lato({ subsets: ['latin'], variable: '--font-body',    weight: ['300','400','700'] });

export const metadata: Metadata = {
  title: 'Panadería POS',
  description: 'Sistema de punto de venta',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${lato.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background:'#261e14', color:'#f0e6d3', border:'1px solid #3a2e1e', borderRadius:'12px', fontSize:'15px' },
            success: { iconTheme: { primary:'#4caf76', secondary:'#14100a' } },
            error:   { iconTheme: { primary:'#e05252', secondary:'#14100a' } },
          }}
        />
      </body>
    </html>
  );
}
