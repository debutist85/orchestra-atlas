import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/bass-drum.webp";
const landscapeMask = `radial-gradient(
  ellipse 58% 75% at 33% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 78% 72% at 38% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const unpitchedPercussionIdentityLayout = instrumentLayout({
  landscape: {
    figure: {
      src: artwork,
      width: "clamp(240px, 56vw, 900px)",
      x: "-20%",
      y: "26%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    fontSize: "clamp(42px, 12vw, 28px)",
    figure: {
      src: artwork,
      width: "clamp(300px, 120vw, 520px)",
      x: "-2%",
      y: "0%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
