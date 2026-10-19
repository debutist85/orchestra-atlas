import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/timpani.webp";
const landscapeMask = `radial-gradient(
  ellipse 58% 50% at 70% 25%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 62% at 28% 25%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const timpaniIdentityLayout = instrumentLayout({
  landscape: {
    edge: "top",
    align: "center",
    side: "outside",
    gap: 8,
    figure: {
      src: artwork,
      width: "clamp(240px, 70vw, 1400px)",
      x: "-10%",
      y: "38%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.3,
      mask: landscapeMask,
    },
  },
  portrait: {
    figure: {
      src: artwork,
      width: "clamp(300px, 120vw, 720px)",
      x: "-0%",
      y: "20%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.3,
      mask: portraitMask,
    },
  },
});
