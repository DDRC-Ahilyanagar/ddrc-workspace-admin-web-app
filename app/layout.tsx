export const dynamic = 'force-dynamic';
import type { Metadata, Viewport } from "next";
import { Work_Sans } from "next/font/google";
import Script from "next/script";
import "bootstrap-icons/font/bootstrap-icons.css";
// NOTE: Keep globals.css import LAST to ensure it overrides vendor styles
import "./globals.css";
import Preloader from "@/components/Preloader";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://surveys.bitnix.store';
const ogImageUrl = `${baseUrl}/ddrc app icon (192 x 192 px) (1024 x 1024 px).png`;

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "DDRC Survey Portal - District Disability Rehabilitation Centre, Ahilyanagar",
    template: "%s | DDRC Ahilyanagar"
  },
  description: "District Disability Rehabilitation Centre (DDRC) Survey Portal - जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर. Ministry of Social Justice & Empowerment, Govt. of India approved initiative for disability data collection and welfare delivery.",
  keywords: ["DDRC", "Disability Rehabilitation", "Ahilyanagar", "Survey Portal", "दिव्यांग पुनर्वसन", "Government Survey 2026", "District Administration Ahilyanagar", "Divyang Survey"],
  authors: [{ name: "DDRC Ahilyanagar", url: baseUrl }],
  creator: "DDRC Ahilyanagar",
  publisher: "DDRC Ahilyanagar",
  alternates: {
    canonical: "/",
    languages: {
      "mr-IN": "/?lang=mr",
      "en-IN": "/?lang=en",
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/ddrc app icon (192 x 192 px) (1024 x 1024 px).png", sizes: "192x192", type: "image/png" },
      { url: "/ddrc app icon (192 x 192 px) (1024 x 1024 px).png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/ddrc app icon (192 x 192 px) (1024 x 1024 px).png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    alternateLocale: ["mr_IN"],
    url: baseUrl,
    siteName: "DDRC Survey Portal Ahilyanagar",
    title: "DDRC Survey Portal - District Disability Rehabilitation Centre, Ahilyanagar",
    description: "Official survey portal for the District Disability Rehabilitation Centre (DDRC) Ahilyanagar. Aiming to collect accurate data to provide better welfare services to Divyang individuals.",
    images: [
      {
        url: `${baseUrl}/ddrc app icon (192 x 192 px) (1024 x 1024 px).png`,
        width: 1024,
        height: 1024,
        alt: "DDRC Ahilyanagar Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DDRC Survey Portal Ahilyanagar",
    description: "Join the mission to empower Divyang individuals in Ahilyanagar through accurate data collection. Official Survey Portal 2026.",
    images: [`${baseUrl}/ddrc app icon (192 x 192 px) (1024 x 1024 px).png`],
    creator: "@DDRCAhilyanagar",
    site: "@DDRCAhilyanagar",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  category: "Government",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0D47A1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script src="https://code.jquery.com/jquery-3.7.1.min.js" strategy="beforeInteractive" id="jquery-script" />
        <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css" />
        <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/dataTables.bootstrap5.min.css" />

        {/* Structured Data for Organizations */}
        <script
          type="application/ld+json"
          id="organization-jsonld"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "GovernmentOrganization",
              "name": "District Disability Rehabilitation Centre (DDRC) Ahilyanagar",
              "alternateName": "जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर",
              "url": baseUrl,
              "logo": `${baseUrl}/ddrc app icon (192 x 192 px) (1024 x 1024 px).png`,
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "0241-2777772",
                "contactType": "customer service",
                "areaServed": "IN",
                "availableLanguage": ["English", "Marathi"]
              },
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Ahilyanagar",
                "addressRegion": "Maharashtra",
                "addressCountry": "IN"
              }
            })
          }}
        />

        {/* Structured Data for WebSite Search */}
        <script
          type="application/ld+json"
          id="website-jsonld"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "DDRC Survey Portal",
              "url": baseUrl,
              "potentialAction": {
                "@type": "SearchAction",
                "target": `${baseUrl}/survekshan?search={search_term_string}`,
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </head>
      <body className={workSans.variable}>
        <Preloader />
        {children}
      </body>
    </html>
  );
}
