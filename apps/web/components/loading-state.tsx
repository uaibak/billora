export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return <div className="card subtle"><p>{label}</p></div>;
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-list" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => <span className="skeleton-row" key={index} />)}
    </div>
  );
}
