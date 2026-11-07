'use client';

import { useRouter } from 'next/navigation';
import { OrbitLanding } from '../../components/orbit/OrbitLanding';

// The drawing from the shared source. Begin opens the sign-in form that already exists.
export default function Welcome() {
  const router = useRouter();
  return (
    <div className="orbit-intro">
      <OrbitLanding onBegin={() => router.push('/login')} />
    </div>
  );
}
