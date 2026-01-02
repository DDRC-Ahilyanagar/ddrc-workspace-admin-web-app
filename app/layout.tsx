import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "DDRC Survey Portal",
  description: "DDRC Survey Portal",
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
      </head>
      <body className={workSans.variable}>
        <Preloader />
        {children}
      </body>
    </html>
  );
}
