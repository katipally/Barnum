import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";

const outfit = loadOutfit("normal", {
  weights: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});
const geistMono = loadGeistMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const font = {
  sans: `${outfit.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  mono: `${geistMono.fontFamily}, ui-monospace, monospace`,
};

// Same tokens as the web app (frontend/src/app/globals.css): blue-black, glass panels, one lavender accent.
export const c = {
  bg: "#07070d",
  surface: "#0d0d16",
  surface2: "#13131e",
  surface3: "#1a1a27",
  line: "rgba(255,255,255,0.07)",
  lineStrong: "rgba(255,255,255,0.13)",
  ink: "#f3f2fa",
  muted: "#8f8ea6",
  faint: "#5c5b70",
  accent: "#b9a7ff",
  accentStrong: "#8b6dff",
  accentInk: "#15102e",
  accentSoft: "rgba(185,167,255,0.13)",
  gold: "#b9a7ff", // legacy name, now the accent
  goldSoft: "rgba(185,167,255,0.13)",
  ok: "#3fd88a",
  warn: "#f2b84b",
  bad: "#ff5d5d",
  info: "#7ea6ff",
};

export const FPS = 30;
