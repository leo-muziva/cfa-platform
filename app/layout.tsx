import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { NavigationHistoryTracker } from "@/components/navigation-history";
import { Suspense } from "react";
import { SiteNavigation } from "@/components/site-navigation";
import { SiteAuth } from "@/components/site-auth";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Cape Fencing Academy",
  description: "Member portal for Cape Fencing Academy",
};

// Inter is the platform's brand typeface (weights 300–700), loaded via
// next/font for zero layout shift (self-hosted, no external font request).
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NavigationHistoryTracker />
          <SiteNavigation
            authSlot={
              hasEnvVars ? (
                <Suspense>
                  <SiteAuth />
                </Suspense>
              ) : (
                <EnvVarWarning />
              )
            }
          />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
