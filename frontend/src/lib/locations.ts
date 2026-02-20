export const ALL_BRANCHES_LABEL = "All Branches";

export const DEMO_LOCATIONS = [
  ALL_BRANCHES_LABEL,
  "The Patiobela",
  "The Maze Bistro",
  "The Maze Forest Mall",
  "Eateroo",
  "Rosa Dames",
] as const;

export type DemoLocation = (typeof DEMO_LOCATIONS)[number];

export function getDemoBranchPool() {
  return DEMO_LOCATIONS.filter((l) => l !== ALL_BRANCHES_LABEL);
}

