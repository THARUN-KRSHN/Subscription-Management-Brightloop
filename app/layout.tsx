import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Brightloop", template: "%s · Brightloop" },
  description: "Subscription management for Brightloop Software.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
