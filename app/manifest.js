
export default function manifest() {
  return {
    id: '/',
    name: 'ORBIT',
    short_name: 'ORBIT',
    description:
      'Daily topic selection, journaling, spaced review and personal progress.',

    start_url: '/',
    scope: '/',

    display: 'standalone',

    background_color: '#ffffff',
    theme_color: '#ffffff',

    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],

    categories: ['education', 'productivity'],
    prefer_related_applications: false,
  };
}
