import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/marimba.webp";
const landscapeMask = `radial-gradient(
  ellipse 68% 55% at 53% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 78% 42% at 28% 25%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const pitchedPercussionIdentityLayout = instrumentLayout({
  landscape: {
        edge: "top",
    align: "center",
    side: "outside",
    gap: 8,
    figure: {
      src: artwork,
      width: "clamp(240px, 76vw, 1600px)",
      x: "0%",
      y: "42%",
      rotation: "-6deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    fontSize: "clamp(42px, 12vw, 28px)",
    figure: {
      src: artwork,
      width: "clamp(300px, 180vw, 1200px)",
      x: "0%",
      y: "0%",
      rotation: "6deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
