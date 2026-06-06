interface Props {
  bg: string;
  children: React.ReactNode;
  /** A key (e.g. scene id) that changes when the scene changes. */
  sceneKey?: string;
}

export function SceneBackground({ bg, children, sceneKey }: Props) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background image — fade-in on scene change */}
      <div
        key={`bg-${sceneKey ?? 'default'}`}
        className="absolute inset-0 bg-cover bg-center scene-bg-enter"
        style={{ backgroundImage: `url('${bg}')` }}
      />
      {/* Scrim for legibility */}
      <div className="absolute inset-0 bg-black/10" />
      {/* Children (things) — fade-in slightly after the bg */}
      <div
        key={`children-${sceneKey ?? 'default'}`}
        className="relative h-full w-full scene-children-enter"
      >
        {children}
      </div>
    </div>
  );
}
