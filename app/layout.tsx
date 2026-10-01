import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lueur-living-gallery.ledengmig29.chatgpt.site"),
  title: "PELAGIC · 瓶中之海 — GPT 6.1 Sol",
  description: "一片宁静的海，一艘驶入风暴的白色三桅帆船，一个藏在玻璃瓶中的世界。Three.js 实时海洋叙事，由 GPT 6.1 Sol 创作。",
  openGraph: {
    title: "PELAGIC · 瓶中之海",
    description: "从宁静海洋驶入风暴，再揭开玻璃瓶中的微缩世界。一段由 Three.js / WebGL 驱动的三幕交互航程。",
    type: "website",
    locale: "zh_CN",
    images: [{
      url: "/pelagic-cover.png",
      width: 1920,
      height: 1080,
      alt: "PELAGIC 瓶中之海：玻璃瓶中的海洋与白色三桅帆船",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PELAGIC · 瓶中之海",
    description: "宁静海洋、风暴航程、瓶中世界。Three.js / WebGL 三幕交互作品。",
    images: ["/pelagic-cover.png"],
  },
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
