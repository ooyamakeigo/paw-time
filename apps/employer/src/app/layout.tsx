import type { Metadata } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "@/components/Toaster";
import { LocaleProvider } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import "./globals.css";

export const dynamic = "force-dynamic";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-zen-maru",
});

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.app.title, description: m.app.description };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [{ locale }, session] = await Promise.all([getMessages(), getSession()]);
  return (
    // Browser extensions (Grammarly, Dark Reader, translators) add attributes to <html> and <body> before React
    // hydrates; those differences are theirs, not ours, so React is told not to report them.
    <html className={zenMaruGothic.variable} data-theme={session.theme === "auto" ? undefined : session.theme} lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LocaleProvider locale={locale}>
          <Toaster>{children}</Toaster>
        </LocaleProvider>
      </body>
    </html>
  );
}
