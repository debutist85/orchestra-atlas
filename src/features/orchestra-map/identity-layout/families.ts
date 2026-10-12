import type { FamilyId } from "../utils/navigation";
import { familyLayout } from "./defaults";
import { brassIdentityLayout } from "./families/brass";
import { otherIdentityLayout } from "./families/other";
import { percussionIdentityLayout } from "./families/percussion";
import { stringsIdentityLayout } from "./families/strings";
import { woodwindsIdentityLayout } from "./families/woodwinds";
import type { IdentityLayouts } from "./types";

export const orchestraIdentityLayout = familyLayout({
  landscape: {
    top: "18%",
    left: "10%",
    anchor: "top-left",
    fontSize: "clamp(12px, 4vw, 50px)",
  },
  portrait: {
    top: "-80%",
    left: "0%",
    anchor: "top-center",
    fontSize: "clamp(12px, 14vw, 80px)",
  },
});

export const familyIdentityLayouts: Record<FamilyId, IdentityLayouts> = {
  strings: stringsIdentityLayout,
  woodwinds: woodwindsIdentityLayout,
  brass: brassIdentityLayout,
  percussion: percussionIdentityLayout,
  other: otherIdentityLayout,
};
