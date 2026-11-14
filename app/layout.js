import './styles/tokens.css';
import './globals.css';
import './features.css';
import './orbit-chrome.css';
import './orbit-ink.css';
import './styles/base.css';
import Shell from '../components/Shell';
import TrialBanner from '../components/TrialBanner';
import DeletionBanner from '../components/DeletionBanner';
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Outfit:wght@300;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <TrialBanner />
        <DeletionBanner />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
