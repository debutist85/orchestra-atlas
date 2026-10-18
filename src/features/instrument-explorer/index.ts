// What the rest of the app uses from the explorer. Stores import the
// content modules they need directly (content/), since those are data, not UI.
export { InstrumentExplore } from './InstrumentExplore'
export { ExperienceMotion } from './experience-motion'
export { canExplore, instrumentExperience, violinExperience } from './content/explorable-instruments'
export { resumeMainPlaybackAfterDemo } from './demonstration/demo-playback-coordination'
