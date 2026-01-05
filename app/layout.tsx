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
  title: "DDRC Survey Portal - District Disability Rehabilitation Centre, Ahilyanagar",
  description: "District Disability Rehabilitation Centre (DDRC) Survey Portal - जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर. Ministry of Social Justice & Empowerment, Govt. of India approved.",
  keywords: ["DDRC", "Disability Rehabilitation", "Ahilyanagar", "Survey Portal", "दिव्यांग पुनर्वसन"],
  authors: [{ name: "DDRC Ahilyanagar" }],
  creator: "DDRC Ahilyanagar",
  publisher: "DDRC Ahilyanagar",
  icons: {
    icon: [
      { url: "/ddrc app icon (192 x 192 px) (1024 x 1024 px).png", sizes: "192x192", type: "image/png" },
      { url: "/ddrc app icon (192 x 192 px) (1024 x 1024 px).png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/ddrc app icon (192 x 192 px) (1024 x 1024 px).png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/ddrc app icon (192 x 192 px) (1024 x 1024 px).png",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    alternateLocale: ["mr_IN"],
    url: baseUrl,
    siteName: "DDRC Survey Portal",
    title: "DDRC Survey Portal - District Disability Rehabilitation Centre, Ahilyanagar",
    description: "District Disability Rehabilitation Centre (DDRC) Survey Portal - जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर. Ministry of Social Justice & Empowerment, Govt. of India approved.",
    images: [
      {
        url: `${baseUrl}/ddrc app icon (192 x 192 px) (1024 x 1024 px).png`,
        width: 1024,
        height: 1024,
        alt: "DDRC Logo - District Disability Rehabilitation Centre, Ahilyanagar",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DDRC Survey Portal - District Disability Rehabilitation Centre, Ahilyanagar",
    description: "District Disability Rehabilitation Centre (DDRC) Survey Portal - जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर",
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
        <Script src="https://code.jquery.com/jquery-3.7.1.min.js" strategy="beforeInteractive" />
        <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css" />
        <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/dataTables.bootstrap5.min.css" />
        {/* Favicon - multiple sizes for better compatibility */}
        <link rel="icon" type="image/png" sizes="192x192" href="/ddrc app icon (192 x 192 px) (1024 x 1024 px).png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/ddrc app icon (192 x 192 px) (1024 x 1024 px).png" />
        <link rel="shortcut icon" href="/ddrc app icon (192 x 192 px) (1024 x 1024 px).png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/ddrc app icon (192 x 192 px) (1024 x 1024 px).png" />
        {/* Manifest for PWA support */}
        <link rel="manifest" href="/manifest.json" />
        {/* Additional meta tags for better social sharing */}
        <meta name="application-name" content="DDRC Survey Portal" />
        <meta name="msapplication-TileColor" content="#0D47A1" />
        <meta name="msapplication-TileImage" content="/ddrc app icon (192 x 192 px) (1024 x 1024 px).png" />
        {/* Open Graph meta tags for Facebook, WhatsApp, Instagram */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:title" content="DDRC Survey Portal - District Disability Rehabilitation Centre, Ahilyanagar" />
        <meta property="og:description" content="District Disability Rehabilitation Centre (DDRC) Survey Portal - जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर. Ministry of Social Justice & Empowerment, Govt. of India approved." />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:secure_url" content={ogImageUrl} />
        <meta property="og:image:width" content="1024" />
        <meta property="og:image:height" content="1024" />
        <meta property="og:image:alt" content="DDRC Logo - District Disability Rehabilitation Centre, Ahilyanagar" />
        <meta property="og:site_name" content="DDRC Survey Portal" />
        <meta property="og:locale" content="en_IN" />
        <meta property="og:locale:alternate" content="mr_IN" />
        {/* Twitter Card meta tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={baseUrl} />
        <meta name="twitter:title" content="DDRC Survey Portal - District Disability Rehabilitation Centre, Ahilyanagar" />
        <meta name="twitter:description" content="District Disability Rehabilitation Centre (DDRC) Survey Portal - जिल्हा दिव्यांग पुनर्वसन केंद्र, अहिल्यानगर" />
        <meta name="twitter:image" content={ogImageUrl} />
        <meta name="twitter:image:alt" content="DDRC Logo - District Disability Rehabilitation Centre, Ahilyanagar" />
        <meta name="twitter:creator" content="@DDRCAhilyanagar" />
        <meta name="twitter:site" content="@DDRCAhilyanagar" />
      </head>
      <body className={workSans.variable}>
        <Preloader />
        {children}
      </body>
    </html>
  );
}
