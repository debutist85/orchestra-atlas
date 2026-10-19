import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/trumpet.webp";
const landscapeMask = `radial-gradient(
  ellipse 88% 75% at 73% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 92% at 78% 35%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const trumpetIdentityLayout = instrumentLayout({
  landscape: {
    edge: "top",
    align: "end",
    side: "outside",
    gap: 1,
    figure: {
      src: artwork,
      width: "clamp(240px, 70vw, 1300px)",
      x: "-5%",
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
      width: "clamp(300px, 180vw, 920px)",
      x: "-10%",
      y: "20%",
      rotation: "-30deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
