
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
    shortcuts: [
      { name: 'Log what I learned', short_name: 'Journal', url: '/journal' },
      { name: 'Recall quiz', short_name: 'Recall', url: '/recall' },
      { name: 'Keystone', short_name: 'Keystone', url: '/keystone' },
      { name: 'Under the hood', short_name: 'Inspect', url: '/inspect' },
    ],
  };
}
