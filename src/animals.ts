// v25u: cluster catalog — 44 tiles covering all 388 sounds.
//
// Each tile is a "thing" the kid recognizes (an animal, a flavor
// bucket, or a themed cluster). Tapping a tile plays a random sound
// from its sounds[] array. The kid gets surprise variety without
// having to scroll through 50 tiles that all look the same.

import { CLUSTERS, type Cluster } from "./audio/clusterCatalog";

export { CLUSTERS };
export type { Cluster };

/** A single grid tile. v25u: 1:1 with a cluster. */
export type Tile = {
  id: string;        // cluster id
  sound: string;     // canonical sound (for tooltips/preview) — picks a random one at tap time
  emoji: string;
  name: string;
  kind: "animal" | "flavor" | "themed";
};

export const TILES: Tile[] = CLUSTERS.map((c) => ({
  id: c.id,
  // The displayed sound is a stable pick (first sound in the cluster).
  // The engine picks a random sound from c.sounds at tap time.
  sound: c.sounds[0],
  emoji: c.emoji,
  name: c.name,
  kind: c.kind,
}));

export const TILE_BY_ID = new Map(TILES.map((t) => [t.id, t]));

/** Pick a random sound from the cluster's sounds[] array. */
export function randomSoundInCluster(clusterId: string): string | null {
  const c = CLUSTERS.find((x) => x.id === clusterId);
  if (!c || c.sounds.length === 0) return null;
  return c.sounds[Math.floor(Math.random() * c.sounds.length)];
}
