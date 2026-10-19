import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/harp.webp";
const landscapeMask = `radial-gradient(
  ellipse 78% 55% at 43% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 72% at 38% 45%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const harpIdentityLayout = instrumentLayout({
  landscape: {
    figure: {
      src: artwork,
      width: "clamp(240px, 42vw, 1200px)",
      x: "-40%",
      y: "10%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    figure: {
      src: artwork,
      width: "clamp(300px, 140vw, 720px)",
      x: "0%",
      y: "-5%",
      rotation: "6deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
