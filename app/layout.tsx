import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUEUR · 光的形状 — 流动的美术馆",
  description: "从梵高的星夜，到普桑的风暴，再到提埃波罗的金色光影。三幅油画，一场缓慢流动的影像展览。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
