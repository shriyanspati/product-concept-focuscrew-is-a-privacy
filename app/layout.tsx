import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

const sourceSerif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"]
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "Soryvo | Study together. Recover together.",
  description:
    "Soryvo is a private AI study room that helps groups regain momentum through privacy-first shared focus support.",
  icons: {
    icon: "/brand/soryvo-favicon.png",
    apple: "/brand/soryvo-favicon.png"
  },
  openGraph: {
    title: "Soryvo | Study together. Recover together.",
    description:
      "Soryvo is a private AI study room that helps groups regain momentum through privacy-first shared focus support.",
    images: ["/brand/soryvo-logo-full.png"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${sourceSerif.variable} ${plexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
