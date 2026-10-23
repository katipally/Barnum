import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";

const geist = loadGeist("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const geistMono = loadGeistMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const font = {
  sans: `${geist.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
  mono: `${geistMono.fontFamily}, ui-monospace, monospace`,
};

export const c = {
  bg: "#0b0d0c",
  surface: "#121514",
  surface2: "#181c1a",
  surface3: "#1f2421",
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.16)",
  ink: "#ece9e2",
  muted: "#8b908c",
  faint: "#5d625f",
  gold: "#d4a84b",
  goldSoft: "rgba(212,168,75,0.14)",
  ok: "#4cb782",
  warn: "#e0a23b",
  bad: "#e5534b",
};

export const FPS = 30;
