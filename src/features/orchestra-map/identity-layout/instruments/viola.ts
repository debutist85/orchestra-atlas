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
  ellipse 52% 40% at 48% 58%,
  black 0%,
  black 28%,
  rgb(0 0 0 / 70%) 48%,
  rgb(0 0 0 / 20%) 66%,
  transparent 82%
)`;

export const violaIdentityLayout = instrumentLayout({
  landscape: {
    top: "20%",
    left: "0%",
    anchor: "top-center",
    figure: {
      src: artwork,
      width: "clamp(400px, 22vw, 520px)",
      x: "0%",
      y: "5%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.3,
      mask: landscapeMask,
    },
  },
  portrait: {
    top: "-30%",
    left: "-20%",
    anchor: "top-center",
    figure: {
      src: artwork,
      width: "clamp(200px, 40vh, 920px)",
      x: "-2%",
      y: "-20%",
      rotation: "5deg",
      scale: 1,
      opacity: 0.3,
      mask: portraitMask,
    },
  },
});
