import type { Metadata } from "next";
import { Geist_Mono, Montserrat, Poppins } from "next/font/google";
import Script from "next/script";

import { LocaleProvider } from "@/components/i18n/locale-provider";
import { getLocaleCookieBootstrapScript, htmlLang } from "@/lib/i18n/locale";
import { getRequestLocale } from "@/lib/i18n/request-locale";
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
    icon: [
      { url: "/favicon/favicon.ico", sizes: "32x32" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/favicon/apple-touch-icon.png", sizes: "180x180" },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html
      lang={htmlLang(locale)}
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
        <Script
          id="ha-locale-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: getLocaleCookieBootstrapScript(),
          }}
        />
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
