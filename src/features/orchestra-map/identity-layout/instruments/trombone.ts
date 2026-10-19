import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/trombone.webp";
const landscapeMask = `radial-gradient(
  ellipse 86% 40% at 53% 28%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 72% at 48% 55%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const tromboneIdentityLayout = instrumentLayout({
  landscape: {
    figure: {
      src: artwork,
      width: "clamp(240px, 80vw, 1500px)",
      x: "10%",
      y: "12%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    fontSize: "clamp(74px, 12vw, 70px)",
    figure: {
      src: artwork,
      width: "clamp(300px, 200vw, 720px)",
      x: "0%",
      y: "12%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
