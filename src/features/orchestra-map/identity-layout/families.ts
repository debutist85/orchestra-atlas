import type { FamilyId } from "../utils/navigation";
import { brassIdentityLayout } from "./families/brass";
import { otherIdentityLayout } from "./families/other";
import { percussionIdentityLayout } from "./families/percussion";
import { stringsIdentityLayout } from "./families/strings";
import { woodwindsIdentityLayout } from "./families/woodwinds";
import type { IdentityLayouts } from "./types";

export const orchestraIdentityLayout: IdentityLayouts = {
  landscape: {
    edge: "top",
    align: "start",
    side: "inside",
    gap: 6,
    fontSize: "clamp(12px, 4vw, 50px)",
  },
  portrait: {
    edge: "top",
    align: "center",
    side: "outside",
    gap: 4,
    fontSize: "clamp(12px, 14vw, 80px)",
  },
};

export const familyIdentityLayouts: Record<FamilyId, IdentityLayouts> = {
  strings: stringsIdentityLayout,
  woodwinds: woodwindsIdentityLayout,
  brass: brassIdentityLayout,
  percussion: percussionIdentityLayout,
  other: otherIdentityLayout,
};
