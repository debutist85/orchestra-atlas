import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/cello.webp";
const landscapeMask = `radial-gradient(
  ellipse 60% 90% at 28% 40%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 76%) 52%,
  rgb(0 0 0 / 24%) 70%,
  transparent 86%
)`;
const portraitMask = `radial-gradient(
  ellipse 50% 70% at 70% 46%,
  black 0%,
  black 30%,
  rgb(0 0 0 / 72%) 50%,
  rgb(0 0 0 / 22%) 68%,
  transparent 84%
)`;

export const celloIdentityLayout = instrumentLayout({
  landscape: {
    top: "8%",
    left: "-60%",
    anchor: "top-center",
    figure: {
      src: artwork,
      width: "clamp(250px, 26vw, 800px)",
      x: "-30%",
      y: "8%",
      rotation: "-7deg",
      scale: 1,
      opacity: 0.3,
      mask: landscapeMask,
    },
  },
  portrait: {
    top: "-40%",
    left: "-15%",
    anchor: "top-center",
    figure: {
      src: artwork,
      width: "clamp(180px, 90vw, 1000px)",
      x: "16%",
      y: "10%",
      rotation: "-4deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
