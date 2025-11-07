'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const loggedIn = localStorage.getItem('logged_in');
    if (loggedIn) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="container-fluid py-4">
      <div className="text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">लोड होत आहे...</span>
        </div>
        </div>
    </div>
  );
}
