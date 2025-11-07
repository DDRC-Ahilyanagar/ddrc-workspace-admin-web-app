declare module 'swagger-ui-react' {
  import { ComponentType } from 'react';
  
  interface SwaggerUIProps {
    spec?: any;
    url?: string;
  }
  
  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}

