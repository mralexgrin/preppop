// Whether this learner can use the AI features. They send what the learner
// typed to Anthropic, and elementary and middle school learners can be under
// 13, so for them AI is off until a grown-up turns it on in Settings.

import { state } from "./store.js";
import { currentLevel } from "./profiles.js";

export const aiNeedsGrownup = () => currentLevel() !== "high";
export const aiAllowed = () => !aiNeedsGrownup() || state.settings.aiOn === true;
// Clinical Shift is practice for clinical work alongside doctors: high school only.
export const shiftAllowed = () => currentLevel() === "high";
