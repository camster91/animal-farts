interface Props {
  bg: string;
  children: React.ReactNode;
}

export function SceneBackground({ bg, children }: Props) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${bg}')` }}
      />
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}
