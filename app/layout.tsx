import type { Metadata } from "next";
import "./globals.css";

// The title names nothing about the content (privacy requirement).
export const metadata: Metadata = {
  title: "Private",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
