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
    edge: "top",
    align: "center",
    side: "outside",
    gap: 8,
    figure: {
      src: artwork,
      width: "clamp(300px, 66vw, 1500px)",
      x: "-15%",
      y: "-25%",
      rotation: "-25deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    figure: {
      src: artwork,
      width: "clamp(300px, 160vw, 820px)",
      x: "5%",
      y: "-5%",
      rotation: "-25deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
