import type { Metadata } from "next";
import "./landing.css";
import { Hero } from "./Hero.tsx";
import { Smooth } from "./Smooth.tsx";
import { Mission } from "./Mission.tsx";
import { Stats } from "./Stats.tsx";
import { Worlds } from "./Worlds.tsx";
import { HowItWorks } from "./HowItWorks.tsx";
import { Proof } from "./Proof.tsx";
import { Limits } from "./Limits.tsx";
import { Cta } from "./Cta.tsx";
import { Footer } from "./Footer.tsx";

export const metadata: Metadata = {
  title: "AfterEarth: a fantasy world you can check",
  description:
    "Four fantasy cities run their own economy. Every season of their history is sealed on NEAR, so anyone can replay it and confirm nothing was changed.",
};

const GITHUB = "https://github.com/theodhorex/AfterHours";
const CONTRACT = "https://testnet.nearblocks.io/address/afterhours-11042120-theo.testnet";

export default function LandingPage() {
  return (
    <main className="lp" id="top">
      <Smooth />
      <a href="#mission" className="lp-skip">Skip to content</a>
      <Hero />
      <Mission />
      <Stats />
      <Worlds />
      <HowItWorks />
      <Proof />
      <Limits />
      <Cta contract={CONTRACT} />
      <Footer github={GITHUB} contract={CONTRACT} />
    </main>
  );
}
