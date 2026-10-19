import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/viola.webp";
const landscapeMask = `radial-gradient(
  ellipse 66% 78% at 24% 48%,
  black 0%,
  black 30%,
  rgb(0 0 0 / 74%) 50%,
  rgb(0 0 0 / 22%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 52% 98% at 70% 50%,
  black 0%,
  black 28%,
  rgb(0 0 0 / 70%) 48%,
  rgb(0 0 0 / 20%) 66%,
  transparent 82%
)`;

export const violaIdentityLayout = instrumentLayout({
  landscape: {
    figure: {
      src: artwork,
      width: "clamp(400px, 22vw, 520px)",
      x: "0%",
      y: "5%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    figure: {
      src: artwork,
      width: "clamp(200px, 40vh, 920px)",
      x: "30%",
      y: "5%",
      rotation: "10deg",
      scale: 1,
      opacity: 0.3,
      mask: portraitMask,
    },
  },
});
