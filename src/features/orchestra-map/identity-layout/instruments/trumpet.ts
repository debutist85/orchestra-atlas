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
    top: "0%",
    left: "20%",
    anchor: "top-center",
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
    top: "-100%",
    left: "-40%",
    anchor: "top-right",
    fontSize: "clamp(74px, 12vw, 70px)",
    figure: {
      src: artwork,
      width: "clamp(300px, 150vw, 920px)",
      x: "-17%",
      y: "10%",
      rotation: "-15deg",
      scale: 1,
      opacity: 0.4,
      mask: portraitMask,
    },
  },
});
