import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/violin.webp";
// Black keeps the artwork; transparent lets it disappear. The ellipse center
// is the visibility field, not a crop of the file.
const landscapeMask = `radial-gradient(
  ellipse 58% 100% at 28% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 88% at 28% 45%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const violinIdentityLayout = instrumentLayout({
  landscape: {
    figure: {
      src: artwork,
      width: "clamp(230px, 18vw, 450px",
      x: "0%",
      y: "20%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    figure: {
      src: artwork,
      width: "clamp(200px, 68vw, 520px)",
      x: "-30%",
      y: "10%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.35,
      mask: portraitMask,
    },
  },
});
