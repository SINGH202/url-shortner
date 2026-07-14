import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://myshrinkly.vercel.app";

// Open Graph guidance: title ≈40–60 chars; description ≈110–160 chars.
const siteTitle = "Snip — Short links with click analytics";
const siteDescription =
  "Create short URLs with custom slugs, QR codes, and click analytics. Sign in to manage links and track every redirect.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s · Snip",
  },
  description: siteDescription,
  applicationName: "Snip",
  keywords: [
    "URL shortener",
    "short links",
    "link analytics",
    "QR code",
    "Next.js",
    "Supabase",
  ],
  authors: [{ name: "Snip" }],
  creator: "Snip",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Snip",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Snip — turn long links into short, shareable ones",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og.png",
        alt: "Snip — turn long links into short, shareable ones",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        {children}
      </body>
    </html>
  );
}
