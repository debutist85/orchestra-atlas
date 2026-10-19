import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/bassoon.webp";
const landscapeMask = `radial-gradient(
  ellipse 78% 55% at 50% 25%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 88% 42% at 28% 45%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const bassoonIdentityLayout = instrumentLayout({
  landscape: {
    figure: {
      src: artwork,
      width: "clamp(240px, 40vw, 900px)",
      x: "-25%",
      y: "13%",
      rotation: "25deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    figure: {
      src: artwork,
      width: "clamp(300px, 110vw, 520px)",
      x: "-15%",
      y: "10%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
