const SKELETON_CARDS = [0, 1, 2, 3];

export const OverviewSkeleton = () => {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      {SKELETON_CARDS.map((index) => (
        <div key={index} className="rounded-lg border bg-card p-card">
          <div className="flex items-center gap-2">
            <div className="size-4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="ml-auto size-6 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="mt-4 flex items-center gap-4">
            {SKELETON_CARDS.map((dot) => (
              <div
                key={dot}
                className="size-dot flex-1 animate-pulse rounded-full bg-muted"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
