export function ResultsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      <div className="skeleton mb-6 h-5 w-40 rounded-full" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="rounded-[1.4rem] border border-line bg-coal p-2">
            <div className="skeleton aspect-[4/5] w-full rounded-[1.05rem]" />
            <div className="space-y-2 px-2 pb-2 pt-3">
              <div className="skeleton h-5 w-3/4 rounded-full" />
              <div className="skeleton h-4 w-1/2 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
