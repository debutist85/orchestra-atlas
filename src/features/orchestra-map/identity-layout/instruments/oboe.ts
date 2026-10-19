import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/oboe.webp";
const landscapeMask = `radial-gradient(
  ellipse 58% 65% at 43% 10%,
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
    figure: {
      src: artwork,
      width: "clamp(200px, 20vw, 350px)",
      x: "-25%",
      y: "25%",
      rotation: "20deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    figure: {
      src: artwork,
      width: "clamp(200px, 50vw, 520px)",
      x: "-50%",
      y: "0%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
