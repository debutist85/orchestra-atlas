import { familyLayout } from "../defaults";

export const otherIdentityLayout = familyLayout({
  landscape: {
    edge: "left",
    align: "start",
    side: "outside",
    fontSize: "clamp(30px, 3vw, 90px)",
  },
  portrait: {
  },
});
