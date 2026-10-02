import { instrumentLayout } from "../defaults";

export const tromboneIdentityLayout = instrumentLayout({
  landscape: {
    top: "30%",
    left: "40%",
    anchor: "top-center",
  },
  portrait: {
    top: "-70%",
    left: "-100%",
    anchor: "top-right",
  },
});
