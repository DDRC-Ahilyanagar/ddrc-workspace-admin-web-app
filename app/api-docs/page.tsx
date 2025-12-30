 'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocsPage() {
  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <SwaggerUI url="/api/swagger" />
    </div>
  );
}



