import React from "react";
import { Composition } from "remotion";
import { AgenticCmo } from "./Video";
import { Storyline } from "./story/Story";
import { STORY_FRAMES } from "./story/timing";
import { Submission60 } from "./submission/Submission";
import { TOTAL_FRAMES } from "./submission/timing";
import { FPS } from "./theme";

export const Root: React.FC = () => (
  <>
    <Composition id="AgenticCmo" component={AgenticCmo} durationInFrames={1800} fps={FPS} width={1920} height={1080} />
    <Composition id="Storyline" component={Storyline} durationInFrames={STORY_FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="Submission60" component={Submission60} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
  </>
);
