export function Message({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return <p className={error ? 'message error' : 'message success'}>{error || success}</p>;
}
