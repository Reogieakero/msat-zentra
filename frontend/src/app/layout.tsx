import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import styles from "./layout.module.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zentra â€” Student Information System",
  description:
    "Zentra SIS for Mati School of Arts and Trades â€” learner records, grading, attendance, and early intervention.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className={styles.root}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
