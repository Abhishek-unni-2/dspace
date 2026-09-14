import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSPΛCE — Real Estate ERP",
  description: "DSPACE real estate ERP — projects, units, leads, realtors, visits, bookings and commissions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
