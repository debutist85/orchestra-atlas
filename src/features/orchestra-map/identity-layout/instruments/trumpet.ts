import { instrumentLayout } from "../defaults";

export const trumpetIdentityLayout = instrumentLayout({
  landscape: {
    top: "0%",
    left: "20%",
    anchor: "top-center",
  },
  portrait: {
    top: "-100%",
    left: "-90%",
    anchor: "top-right",
  },
});
