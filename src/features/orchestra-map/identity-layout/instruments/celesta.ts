import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/celesta.webp";
const landscapeMask = `radial-gradient(
  ellipse 38% 75% at 23% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 90% 50% at 28% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const celestaIdentityLayout = instrumentLayout({
  landscape: {
    top: "-60%",
    left: "-70%",
    anchor: "top-center",
    figure: {
      src: artwork,
      width: "clamp(450px, 56vw, 1200px)",
      x: "0%",
      y: "30%",
      rotation: "-6deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    top: "-180%",
    left: "20%",
    anchor: "top-center",
    figure: {
      src: artwork,
      width: "clamp(300px, 140vw, 900px)",
      x: "0%",
      y: "0%",
      rotation: "6deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
