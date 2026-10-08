import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/oboe.webp";
const landscapeMask = `radial-gradient(
  ellipse 58% 75% at 33% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 42% at 28% 55%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const oboeIdentityLayout = instrumentLayout({
  landscape: {
    top: "-20%",
    left: "30%",
    anchor: "top-center",
    figure: {
      src: artwork,
      width: "clamp(240px, 12vw, 400px)",
      x: "-16%",
      y: "22%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.3,
      mask: landscapeMask,
    },
  },
  portrait: {
    top: "-150%",
    left: "0%",
    anchor: "top-center",
    figure: {
      src: artwork,
      width: "clamp(300px, 70vw, 520px)",
      x: "-14%",
      y: "-15%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.35,
      mask: portraitMask,
    },
  },
});
