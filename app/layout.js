import './globals.css';
import './features.css';
import './orbit-chrome.css';
import Shell from '../components/Shell';
import { THEME_BOOT_SCRIPT } from '../lib/theme';

export const metadata = {
  metadataBase: new URL('https://orbit-steel-tau.vercel.app'),
  title: 'Orbit',
  description: 'Daily topic selection, journaling, spaced review and progress.',
  appleWebApp: { capable: true, title: 'Orbit', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
