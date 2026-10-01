import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Foodi · Quiz Assistant",
  description: "Find supported answers to Foodi employee quizzes.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
