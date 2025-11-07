'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/AdminLayout';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<any>(null);

  useEffect(() => {
    fetch('/api/swagger')
      .then(res => res.json())
      .then(data => setSpec(data));
  }, []);

  if (!spec) {
    return (
      <AdminLayout>
        <div className="container-fluid">
          <div className="text-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container-fluid">
        <h1 className="title mb-4 animate__animated animate__fadeInDown">API Documentation</h1>
        <div className="swagger-ui-wrapper animate__animated animate__fadeInUp">
          <SwaggerUI spec={spec} />
        </div>
        <style jsx global>{`
          .swagger-ui-wrapper {
            margin-top: 2rem;
          }
        `}</style>
      </div>
    </AdminLayout>
  );
}

