export function Loading({ label = 'Opening the ledger...' }: { label?: string }) {
  return <div className="loading" role="status"><span aria-hidden="true" />{label}</div>;
}
