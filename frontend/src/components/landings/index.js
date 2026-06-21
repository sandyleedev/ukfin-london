// Registry of landing-page variants. To change the live homepage, set
// DEFAULT_LANDING below to any key here — that's the only edit needed.
// During review you can also preview any variant via ?landing=<key>.
import LandingCinematic from "../LandingPage.jsx";
import LandingSaaS from "./LandingSaaS.jsx";
import LandingConsole from "./LandingConsole.jsx";
import LandingMinimal from "./LandingMinimal.jsx";

export const LANDINGS = {
  cinematic: { label: "Cinematic HUD", Component: LandingCinematic },
  saas: { label: "SaaS Product", Component: LandingSaaS },
  console: { label: "Audit Console", Component: LandingConsole },
  minimal: { label: "Minimal", Component: LandingMinimal },
};

// 👇 The single switch that controls which homepage ships.
export const DEFAULT_LANDING = "minimal";
