import './globals.css';
import Shell from '../components/Shell';

export const metadata = {
  title: 'Orbit',
  description: 'Daily topic selection, journaling and spaced review.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
