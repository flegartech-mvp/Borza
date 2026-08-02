import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/features/auth/auth-provider";
import { DemoWorkspaceProvider } from "@/features/demo/demo-workspace-provider";
import { PREFERENCE_BOOTSTRAP_SCRIPT, PreferencesProvider } from "@/features/preferences";
import { BorzaQueryProvider } from "@/features/query/query-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Borza Academy", template: "%s | Borza Academy" },
  description: "Learn finance. Practise trading. Build real market skills.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script id="borza-preferences-bootstrap" dangerouslySetInnerHTML={{ __html: PREFERENCE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <BorzaQueryProvider>
          <PreferencesProvider>
            <AuthProvider>
              <DemoWorkspaceProvider>{children}</DemoWorkspaceProvider>
            </AuthProvider>
          </PreferencesProvider>
        </BorzaQueryProvider>
      </body>
    </html>
  );
}
