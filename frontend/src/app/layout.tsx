import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import styles from "./layout.module.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zentra — Student Information System",
  description:
    "Zentra SIS for Mati School of Arts and Trades — learner records, grading, attendance, and early intervention.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className={styles.root}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
