import type { Metadata } from "next";
import { SCREEN_HEIGHT_SCRIPT } from "./full-screen";
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
    // The head script below may set --screen-h on <html> before React takes over.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* iPhone home-screen app: size the page to the real screen before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: SCREEN_HEIGHT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
