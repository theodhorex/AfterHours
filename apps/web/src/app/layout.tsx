import type { Metadata } from "next";
import { Cinzel, Alegreya, JetBrains_Mono, Pixelify_Sans, Silkscreen } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
});

const alegreya = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
  display: "swap",
});

const jbMono = JetBrains_Mono({
  variable: "--font-jb-mono",
  subsets: ["latin"],
  display: "swap",
});

const pixelifySans = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
  display: "swap",
});

const silkscreen = Silkscreen({
  variable: "--font-silk",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AfterEarth",
  description: "Verifiable fantasy economy and living settlement simulation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${alegreya.variable} ${jbMono.variable} ${pixelifySans.variable} ${silkscreen.variable}`}>
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
