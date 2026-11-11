import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import styles from "./layout.module.css";

/* Desk typography: every role shell renders in Inter (sans). */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zentra — Every learner in focus",
  description:
    "Zentra is the Student Information & Management System for Mati School of Arts and Trades — grading, attendance, records, early intervention, and ADM in one living record.",
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
