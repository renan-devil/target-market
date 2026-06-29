import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OSS GTM Tool",
  description:
    "Go-to-market intelligence: turn an ICP into observable signals and map industrial targets across Europe & the US.",
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
