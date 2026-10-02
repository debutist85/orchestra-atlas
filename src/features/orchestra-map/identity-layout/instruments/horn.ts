import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/horn.webp";
const landscapeMask = `radial-gradient(
  ellipse 58% 58% at 33% 43%,
  black 0%,
  black 36%,
  rgb(0 0 0 / 78%) 54%,
  rgb(0 0 0 / 24%) 72%,
  transparent 88%
)`;
const portraitMask = `radial-gradient(
  ellipse 62% 68% at 42% 38%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 72%) 50%,
  rgb(0 0 0 / 22%) 68%,
  transparent 84%
)`;

export const hornIdentityLayout = instrumentLayout({
  landscape: {
    top: "30%",
    left: "0%",
    anchor: "bottom-center",
    figure: {
      src: artwork,
      width: "clamp(300px, 98vw, 1120px)",
      x: "-2%",
      y: "-28%",
      rotation: "-25deg",
      scale: 1.05,
      opacity: 0.35,
      mask: landscapeMask,
    },
  },
  portrait: {
    top: "-170%",
    left: "0%",
    anchor: "top-center",
    figure: {
      src: artwork,
      width: "clamp(300px, 124vw, 820px)",
      x: "5%",
      y: "-15%",
      rotation: "-25deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
