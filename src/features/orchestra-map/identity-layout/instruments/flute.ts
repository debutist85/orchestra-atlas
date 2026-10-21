import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/flute.webp";
const landscapeMask = `radial-gradient(
  ellipse 58% 55% at 33% 28%,
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

export const fluteIdentityLayout = instrumentLayout({
  landscape: {
    edge: "top",
    align: "start",
    side: "outside",
    gap: 2,
    figure: {
      src: artwork,
      width: "clamp(200px, 16vw, 250px)",
      x: "70%",
      y: "23%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.3,
      mask: landscapeMask,
    },
  },
  portrait: {
    edge: "top",
    align: "center",
    side: "outside",
    gap: 8,
    figure: {
      src: artwork,
      width: "clamp(200px, 40vw, 520px)",
      x: "-40%",
      y: "0%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.3,
      mask: portraitMask,
    },
  },
});
