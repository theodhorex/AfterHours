import { Hanken_Grotesk, IM_Fell_English } from "next/font/google";

const fell = IM_Fell_English({
  variable: "--font-fell",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fell.variable} ${hanken.variable}`}>{children}</div>;
}
