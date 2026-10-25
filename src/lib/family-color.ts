import type { FamilyMember, Relationship } from "./types";

export interface FamilySwatch {
  key: string;
  label: string;
  primary: string;
  background: string;
  border: string;
  text: string;
}

export const FAMILY_SWATCHES = {
  mummy: {
    key: "mummy",
    label: "Mummy",
    primary: "#E58F7D",
    background: "#FCE8E1",
    border: "#EFC0B4",
    text: "#8F4538",
  },
  papa: {
    key: "papa",
    label: "Papa",
    primary: "#C8944F",
    background: "#F8EBD5",
    border: "#E9D1A6",
    text: "#80551F",
  },
  dadi: {
    key: "dadi",
    label: "Dadi",
    primary: "#B87866",
    background: "#F5E3DC",
    border: "#E2BEB2",
    text: "#78483D",
  },
} as const satisfies Record<string, FamilySwatch>;

/** Extra warm identities when the family has more people than the named set. */
export const COLOR_PALETTE: FamilySwatch[] = [
  { ...FAMILY_SWATCHES.mummy },
  { ...FAMILY_SWATCHES.papa },
  { ...FAMILY_SWATCHES.dadi },
];

export const FAMILY_FALLBACK_SWATCHES: FamilySwatch[] = [
  { key: "sand", label: "Family", primary: "#C4A484", background: "#F6EBDD", border: "#E4D0B8", text: "#6F5340" },
  { key: "clay", label: "Family", primary: "#C07A5A", background: "#F6E4D8", border: "#E5C2AE", text: "#7A4632" },
  { key: "olive", label: "Family", primary: "#A88A4E", background: "#F3EBD4", border: "#DCCBA0", text: "#6A5424" },
  { key: "rosewood", label: "Family", primary: "#B56B6B", background: "#F6E2E2", border: "#E3B8B8", text: "#7A3C3C" },
];

export const NEUTRAL_SWATCH: FamilySwatch = {
  key: "neutral",
  label: "Family",
  primary: "#C4B4A6",
  background: "#F6EFE9",
  border: "#E8DDD4",
  text: "#8B6F5E",
};

const NAME_ALIAS: Record<string, keyof typeof FAMILY_SWATCHES> = {
  mummy: "mummy",
  mother: "mummy",
  mom: "mummy",
  mama: "mummy",
  माँ: "mummy",
  papa: "papa",
  father: "papa",
  dad: "papa",
  daddy: "papa",
  पापा: "papa",
  dadi: "dadi",
  grandmother: "dadi",
  grandma: "dadi",
  nani: "dadi",
  दादी: "dadi",
};

const RELATIONSHIP_ALIAS: Partial<Record<Relationship, keyof typeof FAMILY_SWATCHES>> = {
  Mother: "mummy",
  Father: "papa",
  Grandmother: "dadi",
};

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function namedFamilyKey(member: Pick<FamilyMember, "id" | "name" | "relationship">): keyof typeof FAMILY_SWATCHES | null {
  const id = member.id.trim().toLowerCase();
  if (id in FAMILY_SWATCHES) return id as keyof typeof FAMILY_SWATCHES;
  const name = member.name.trim().toLowerCase();
  if (name in NAME_ALIAS) return NAME_ALIAS[name];
  return RELATIONSHIP_ALIAS[member.relationship] ?? null;
}

export function swatchByKey(key: string | undefined): FamilySwatch | undefined {
  if (!key) return undefined;
  if (key in FAMILY_SWATCHES) return FAMILY_SWATCHES[key as keyof typeof FAMILY_SWATCHES];
  return FAMILY_FALLBACK_SWATCHES.find((s) => s.key === key);
}

export function allColorChoices(): FamilySwatch[] {
  return [...COLOR_PALETTE, ...FAMILY_FALLBACK_SWATCHES];
}

export function familySwatch(member?: Pick<FamilyMember, "id" | "name" | "relationship" | "colorKey"> | null): FamilySwatch {
  if (!member?.id) return NEUTRAL_SWATCH;
  const preferred = swatchByKey(member.colorKey);
  if (preferred) return { ...preferred, label: member.name };
  const named = namedFamilyKey(member);
  if (named) return { ...FAMILY_SWATCHES[named], label: member.name };
  const fallback = FAMILY_FALLBACK_SWATCHES[hashId(member.id) % FAMILY_FALLBACK_SWATCHES.length];
  return { ...fallback, key: `fallback-${member.id}`, label: member.name };
}

export function familyLegend(members: Pick<FamilyMember, "id" | "name" | "relationship">[]): FamilySwatch[] {
  return members.map((m) => familySwatch(m));
}

