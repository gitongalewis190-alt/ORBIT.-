'use client';
import dynamic from 'next/dynamic';
import Skeleton from '../../components/Skeleton';

const ParallaxScreen = dynamic(() => import('../../components/parallax/ParallaxScreen'), {
  ssr: false,
  loading: () => <Skeleton lines={4} label="Loading Parallax" />,
});

export default function ParallaxPage() {
  return <ParallaxScreen />;
}
