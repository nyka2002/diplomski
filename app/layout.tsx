import "./globals.css";
import type { Metadata } from "next";
import { AppProvider } from "@/lib/app-context";
import Header from "@/components/Header";
import { getCurrentProfile } from "@/lib/auth/profile";
import { fetchSavedIds } from "@/lib/listings/query";

export const metadata: Metadata = {
  title: "real estate ad management app",
  description:
    "browse, save, and manage real estate listings for buying or renting with AI-powered search and personalized account features.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const savedIds = profile ? await fetchSavedIds(profile.id) : [];

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-background text-foreground"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        <AppProvider profile={profile} initialSavedIds={savedIds}>
          <Header />
          <main>{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
