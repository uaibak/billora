import type { PaginationMeta } from '../lib/api';

export function Pagination({ meta, page, onPageChange }: { meta: PaginationMeta | null; page: number; onPageChange: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="secondary" type="button" onClick={() => onPageChange(Math.max(page - 1, 1))} disabled={page <= 1}>Previous</button>
      <span>Page {meta.page} of {meta.totalPages}</span>
      <button className="secondary" type="button" onClick={() => onPageChange(Math.min(page + 1, meta.totalPages))} disabled={page >= meta.totalPages}>Next</button>
    </div>
  );
}
