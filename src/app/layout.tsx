import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/AppLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoldQuant AI - Risk Manager Dashboard",
  description: "Bảng quản lý rủi ro giao dịch tài khoản vàng chuyên nghiệp tích hợp AI phân tích số liệu thực tế",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-dark-bg text-dark-text-light">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}

