import type { ReactNode } from 'react';
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><div className="empty-sun" aria-hidden="true" /><h2 className="display">{title}</h2><p>{children}</p></div>;
}
