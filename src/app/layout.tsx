import type { Metadata } from "next";
import { Prompt, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import Navbar from '@/components/Navbar';

// Display face — used for headings, brand wordmark, page titles
const prompt = Prompt({
  variable: "--font-display",
  subsets: ["latin", "thai"],
  weight: ["500", "600", "700", "800"],
});

// Body face — used for everything else (UI text, tables, forms)
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-body",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SPB Supply Bridge",
  description: "ระบบจัดซื้อและตรวจรับสินค้าสำเพ็ง",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${prompt.variable} ${plexThai.variable} antialiased`}>
        <Navbar /> 
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
