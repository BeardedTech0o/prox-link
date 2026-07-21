import { useState } from 'react';
import Icon from './Icon';

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Require typing this exact text to enable confirm (destructive actions). */
  typeToConfirm?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirmation gate for actions against real infrastructure. Destructive ones can
// require type-to-confirm.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  typeToConfirm,
  busy,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const [typed, setTyped] = useState('');
  if (!open) return null;
  const blocked = typeToConfirm ? typed !== typeToConfirm : false;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="panel w-full max-w-sm p-5 flex flex-col gap-4 animate-slide-in">
        <div className="flex items-center gap-3">
          <Icon
            name={danger ? 'warning' : 'help'}
            size={26}
            className={danger ? 'text-danger' : 'text-accent'}
          />
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-sm text-secondary">{message}</p>
        {typeToConfirm && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-secondary">
              Type <span className="font-mono text-primary">{typeToConfirm}</span> to
              confirm
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full px-3 py-2 bg-surface rounded-xl border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-colors"
            />
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="btn-ghost text-sm text-secondary hover:text-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={blocked || busy}
            className={`px-4 py-2 rounded-2xl text-sm font-medium transition-opacity disabled:opacity-40 ${
              danger ? 'bg-danger text-white' : 'bg-accent text-gray-950'
            } hover:opacity-90`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
