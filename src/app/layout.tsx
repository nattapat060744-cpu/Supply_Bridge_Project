import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f1f4f8",
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
        {/* เว้นที่ด้านล่างให้แถบเมนูมือถือ ไม่ให้บังเนื้อหา */}
        <main className="min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
      </body>
    </html>
  );
}