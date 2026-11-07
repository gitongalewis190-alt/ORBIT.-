'use client';
import Link from 'next/link';

export default function BackLink({ href = '/', label = 'Back' }) {
  return (
    <Link href={href} className="btn sm">{label}</Link>
  );
}
