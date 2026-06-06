// v25w: scene system. Each scene = an illustrated background (sky +
// ground + decorative emoji) plus a curated grid of emoji tiles.
// Tapping a tile plays a random sound from that cluster's bucket.

import type { ReactNode } from "react";
import { CLUSTERS, type Cluster } from "./audio/clusterCatalog";

export type { Cluster };

export type SceneId = "farm" | "jungle" | "ocean" | "city" | "bedroom" | "bathroom";

export interface SceneDef {
  id: SceneId;
  name: string;
  emoji: string;
  sky: string;
  ground: string;
  decorations: Array<{ emoji: string; x: number; y: number; size?: number; opacity?: number }>;
}

export const SCENES: Record<SceneId, SceneDef> = {
  farm: {
    id: "farm", name: "Farm", emoji: "🌾",
    sky: "from-sky-300 via-sky-200 to-sky-100",
    ground: "from-lime-300 via-green-400 to-emerald-500",
    decorations: [
      { emoji: "☀️", x: 90, y: 10, size: 7, opacity: 0.95 },
      { emoji: "☁️", x: 18, y: 12, size: 5, opacity: 0.85 },
      { emoji: "☁️", x: 70, y: 20, size: 4, opacity: 0.7 },
      { emoji: "🌳", x: 6, y: 32, size: 7, opacity: 0.9 },
      { emoji: "🌳", x: 94, y: 34, size: 6, opacity: 0.85 },
      { emoji: "🏠", x: 50, y: 28, size: 7, opacity: 0.9 },
      { emoji: "🐝", x: 30, y: 22, size: 2, opacity: 0.7 },
      { emoji: "🦋", x: 75, y: 28, size: 2, opacity: 0.6 },
    ],
  },
  jungle: {
    id: "jungle", name: "Jungle", emoji: "🌴",
    sky: "from-emerald-200 via-lime-300 to-green-400",
    ground: "from-emerald-500 via-green-600 to-emerald-700",
    decorations: [
      { emoji: "🌴", x: 4, y: 28, size: 9, opacity: 0.95 },
      { emoji: "🌴", x: 95, y: 30, size: 8, opacity: 0.9 },
      { emoji: "🌿", x: 22, y: 12, size: 4, opacity: 0.6 },
      { emoji: "🌿", x: 78, y: 10, size: 3, opacity: 0.6 },
      { emoji: "🍃", x: 45, y: 6, size: 2, opacity: 0.5 },
      { emoji: "🌺", x: 15, y: 70, size: 3, opacity: 0.7 },
      { emoji: "🌺", x: 90, y: 75, size: 3, opacity: 0.7 },
      { emoji: "🦜", x: 78, y: 16, size: 4, opacity: 0.85 },
    ],
  },
  ocean: {
    id: "ocean", name: "Ocean", emoji: "🌊",
    sky: "from-sky-300 via-cyan-200 to-sky-200",
    ground: "from-cyan-400 via-blue-500 to-blue-700",
    decorations: [
      { emoji: "☀️", x: 86, y: 8, size: 5, opacity: 0.85 },
      { emoji: "☁️", x: 16, y: 10, size: 4, opacity: 0.7 },
      { emoji: "⛅", x: 70, y: 16, size: 3, opacity: 0.6 },
      { emoji: "🌊", x: 10, y: 48, size: 4, opacity: 0.6 },
      { emoji: "🌊", x: 80, y: 64, size: 4, opacity: 0.6 },
      { emoji: "🐚", x: 25, y: 80, size: 2, opacity: 0.7 },
      { emoji: "🐟", x: 60, y: 70, size: 3, opacity: 0.5 },
    ],
  },
  city: {
    id: "city", name: "City", emoji: "🏙️",
    sky: "from-orange-200 via-amber-200 to-sky-200",
    ground: "from-slate-400 via-gray-500 to-zinc-600",
    decorations: [
      { emoji: "☀️", x: 88, y: 8, size: 4, opacity: 0.85 },
      { emoji: "☁️", x: 14, y: 12, size: 3, opacity: 0.6 },
      { emoji: "🏢", x: 4, y: 24, size: 6, opacity: 0.85 },
      { emoji: "🏢", x: 92, y: 22, size: 6, opacity: 0.85 },
      { emoji: "🏬", x: 16, y: 48, size: 4, opacity: 0.6 },
      { emoji: "🚏", x: 60, y: 76, size: 3, opacity: 0.7 },
      { emoji: "🚦", x: 28, y: 74, size: 3, opacity: 0.7 },
    ],
  },
  bedroom: {
    id: "bedroom", name: "Bedroom", emoji: "🛏️",
    sky: "from-indigo-400 via-purple-400 to-pink-400",
    ground: "from-purple-500 via-violet-500 to-indigo-600",
    decorations: [
      { emoji: "🌙", x: 80, y: 10, size: 6, opacity: 0.95 },
      { emoji: "⭐", x: 18, y: 8, size: 3, opacity: 0.85 },
      { emoji: "⭐", x: 30, y: 16, size: 2, opacity: 0.7 },
      { emoji: "⭐", x: 60, y: 12, size: 2, opacity: 0.7 },
      { emoji: "🛏️", x: 5, y: 60, size: 7, opacity: 0.85 },
      { emoji: "💤", x: 20, y: 70, size: 3, opacity: 0.8 },
    ],
  },
  bathroom: {
    id: "bathroom", name: "Bathroom", emoji: "🛁",
    sky: "from-cyan-200 via-sky-200 to-blue-200",
    ground: "from-cyan-300 via-sky-300 to-blue-300",
    decorations: [
      { emoji: "🛁", x: 6, y: 55, size: 7, opacity: 0.85 },
      { emoji: "🪥", x: 50, y: 22, size: 3, opacity: 0.85 },
      { emoji: "🧼", x: 14, y: 16, size: 3, opacity: 0.85 },
      { emoji: "🧴", x: 84, y: 20, size: 3, opacity: 0.85 },
      { emoji: "🚿", x: 76, y: 48, size: 5, opacity: 0.85 },
      { emoji: "🫧", x: 26, y: 38, size: 2, opacity: 0.7 },
      { emoji: "🫧", x: 70, y: 68, size: 2, opacity: 0.7 },
    ],
  },
};

export const SCENE_LIST: SceneDef[] = Object.values(SCENES);

export interface SceneLayout {
  scene: SceneDef;
  tiles: string[];
}

export const SCENE_LAYOUTS: Record<SceneId, SceneLayout> = {
  farm: {
    scene: SCENES.farm,
    tiles: [
      "animal:cow", "animal:pig", "animal:horse", "animal:sheep",
      "animal:goat", "animal:duck", "animal:rooster", "animal:bull",
      "animal:rabbit", "themed:machine",
    ],
  },
  jungle: {
    scene: SCENES.jungle,
    tiles: [
      "animal:elephant", "animal:lion", "animal:monkey", "animal:snake",
      "animal:bear", "animal:frog", "animal:hippo", "animal:turtle",
      "animal:bird", "animal:zebra",
    ],
  },
  ocean: {
    scene: SCENES.ocean,
    tiles: [
      "animal:whale", "animal:seal",
      "flavor:wet", "flavor:bubbly", "flavor:long", "flavor:echo",
      "themed:water", "themed:other",
    ],
  },
  city: {
    scene: SCENES.city,
    tiles: [
      "themed:machine", "themed:horn", "themed:boing",
      "flavor:dry", "flavor:squeaky", "flavor:long",
      "themed:brrt", "themed:scream", "themed:flute",
    ],
  },
  bedroom: {
    scene: SCENES.bedroom,
    tiles: [
      "themed:sleep", "animal:cat", "animal:dog",
      "themed:groan", "themed:breath", "themed:sneeze",
      "themed:cough", "themed:kiss",
    ],
  },
  bathroom: {
    scene: SCENES.bathroom,
    tiles: [
      "themed:toilet", "flavor:wet", "flavor:bubbly", "flavor:echo",
      "themed:water", "themed:other", "themed:groan",
    ],
  },
};

export function findCluster(id: string): Cluster | null {
  return CLUSTERS.find((c) => c.id === id) ?? null;
}

export interface SceneBackgroundProps {
  scene: SceneDef;
  children: ReactNode;
}

export function SceneBackground({ scene, children }: SceneBackgroundProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className={"absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b " + scene.sky} />
      <div className={"absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-b " + scene.ground} />
      <div className="absolute inset-x-0 top-2/5 h-px bg-white/30" />
      {scene.decorations.map((d, i) => (
        <div
          key={i}
          className="absolute pointer-events-none select-none"
          style={{
            left: d.x + "%",
            top: d.y + "%",
            fontSize: (d.size ?? 5) + "vw",
            opacity: d.opacity ?? 1,
            transform: "translate(-50%, -50%)",
            lineHeight: 1,
          }}
        >
          {d.emoji}
        </div>
      ))}
      <div className="relative h-full w-full flex flex-col">{children}</div>
    </div>
  );
}
