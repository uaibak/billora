export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return <div className="card subtle"><p>{label}</p></div>;
}
