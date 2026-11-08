'use client';
import dynamic from 'next/dynamic';
import Skeleton from '../../components/Skeleton';

const KeystoneScreen = dynamic(() => import('../../components/keystone/KeystoneScreen'), {
  ssr: false,
  loading: () => <Skeleton lines={4} label="Loading Keystone" />,
});

export default function KeystonePage() {
  return <KeystoneScreen />;
}
