import type { Metadata } from "next";
import { Geist_Mono, Montserrat, Poppins } from "next/font/google";
import Script from "next/script";

import { getAccentPresetBootstrapScript } from "@/lib/ui/accent-preset";

import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Humana Analytics",
  description:
    "Website analytics environment where Marketing can explore data with AI.",
  icons: {
    icon: "/favicon/favicon.svg",
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
      className={`${poppins.variable} ${montserrat.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <Script
          id="ha-accent-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: getAccentPresetBootstrapScript(),
          }}
        />
        {children}
      </body>
    </html>
  );
}
