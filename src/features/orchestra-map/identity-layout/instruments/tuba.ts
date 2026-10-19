import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/tuba.webp";
const landscapeMask = `radial-gradient(
  ellipse 58% 75% at 53% 45%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 82% at 58% 65%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const tubaIdentityLayout = instrumentLayout({
  landscape: {
    fontSize: "clamp(54px, 10vw, 90px)",
    figure: {
      src: artwork,
      width: "clamp(240px, 44vw, 1100px)",
      x: "0%",
      y: "0%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    fontSize: "clamp(74px, 12vw, 90px)",
    figure: {
      src: artwork,
      width: "clamp(300px, 130vw, 1220px)",
      x: "-20%",
      y: "0%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
