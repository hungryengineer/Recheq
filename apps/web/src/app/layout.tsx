import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tieout - Background Verification',
  description: 'Automated background verification for modern teams.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
