'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// SwaggerUI uses browser-only globals so it must be loaded client-side only
const SwaggerUI = nextDynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => <div className="p-10 text-center">Loading Documentation...</div>
});

export default function ApiDocsPage() {
  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <SwaggerUI url="/api/swagger" />
    </div>
  );
}



