import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./theme";

/** Smooth 0→1 spring starting at `delay` frames. */
export const rise = (frame: number, delay = 0, damping = 200, durationInFrames?: number) =>
  spring({ frame: frame - delay, fps: FPS, config: { damping }, durationInFrames });

/** Eased 0→1 ramp between two frames. */
export const ramp = (frame: number, from: number, to: number, easing = Easing.bezier(0.22, 1, 0.36, 1)) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const mix = (t: number, a: number, b: number) => a + (b - a) * t;
