import React from "react";
import { Composition } from "remotion";
import { AgenticCmo } from "./Video";
import { FPS } from "./theme";

export const Root: React.FC = () => (
  <Composition id="AgenticCmo" component={AgenticCmo} durationInFrames={1800} fps={FPS} width={1920} height={1080} />
);
