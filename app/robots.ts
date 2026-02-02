import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://surveys.bitnix.store';

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    '/admin/',
                    '/dashboard/',
                    '/login/',
                    '/surveys/',
                    '/sections/',
                    '/questions/',
                    '/access-requests/',
                    '/officers/'
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
