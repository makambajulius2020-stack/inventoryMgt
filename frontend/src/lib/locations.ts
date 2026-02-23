export const ALL_BRANCHES_LABEL = "All Branches";

export const DEMO_LOCATIONS = [
  ALL_BRANCHES_LABEL,
  "Patiobela",
  "Eateroo",
  "Villa",
] as const;

export type DemoLocation = (typeof DEMO_LOCATIONS)[number];

export function getDemoBranchPool() {
  return DEMO_LOCATIONS.filter((l) => l !== ALL_BRANCHES_LABEL);
}

