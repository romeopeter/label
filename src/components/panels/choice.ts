/**
 * How every preset, swatch and option tile shows hover and selection: the accent
 * border the 3D presets use, the same purple as a selected toggle. Selected adds a
 * ring, so it still reads apart from a tile that's only hovered.
 */
export const choiceClass = (selected: boolean) =>
  selected ? "border-secondary ring-1 ring-secondary" : "border-hairline hover:border-secondary";
