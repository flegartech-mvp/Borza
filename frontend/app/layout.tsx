import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  PREFERENCE_BOOTSTRAP_SCRIPT,
  PreferencesProvider,
} from "@/features/preferences";
import { BorzaQueryProvider } from "@/features/query/query-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Borza | Financial news, explained",
  description:
    "Beginner-friendly financial news with method-aware article tone and transparent attention scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          id="borza-preferences-bootstrap"
          dangerouslySetInnerHTML={{ __html: PREFERENCE_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body>
        <BorzaQueryProvider>
          <PreferencesProvider>{children}</PreferencesProvider>
        </BorzaQueryProvider>
      </body>
    </html>
  );
}
