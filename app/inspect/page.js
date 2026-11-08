'use client';
import dynamic from 'next/dynamic';
import Skeleton from '../../components/Skeleton';

const InspectorScreen = dynamic(() => import('../../components/inspect/InspectorScreen'), {
  ssr: false,
  loading: () => <Skeleton lines={4} label="Loading Under the hood" />,
});

export default function InspectPage() {
  return <InspectorScreen />;
}
