import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import type { Notice } from '../lib/notifications';
import type { PropsWithChildren } from 'react';
import './toast.css';

type Toast = Notice & { id: number };

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    function receive(event: Event) {
      const detail = (event as CustomEvent<Notice>).detail;
      const id = Date.now() + Math.random();
      setToasts((items) => [...items.slice(-2), { ...detail, id }]);
      window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5200);
    }
    window.addEventListener('3digit:notice', receive);
    return () => window.removeEventListener('3digit:notice', receive);
  }, []);
  return <>{children}<div className="toast-stack" aria-label="Notifications">{toasts.map((toast) => {
    const Icon = toast.kind === 'error' ? CircleAlert : toast.kind === 'success' ? CircleCheck : Info;
    return <div className={`toast toast-${toast.kind}`} key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}><Icon size={19}/><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}><X size={16}/></button></div>;
  })}</div></>;
}
