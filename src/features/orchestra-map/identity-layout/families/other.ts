import { familyLayout } from "../defaults";

export const otherIdentityLayout = familyLayout({
  landscape: {
    edge: "left",
    align: "start",
    side: "outside",
  },
  portrait: {
    edge: "top",
    align: "center",
    side: "outside",
    gap: 4,
  },
});
