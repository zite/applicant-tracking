import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { upsertOffer } from 'zitejs/api';
import { money } from '../lib/format';
import type { GetApplicationOutputType } from 'zitejs/api';

type Offer = NonNullable<GetApplicationOutputType['offer']>;
const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Sent', 'Accepted', 'Declined', 'Rescinded'] as const;

const tone = (s: string | null) => {
  switch (s) {
    case 'Accepted': return 'border-tone-success/30 bg-tone-success/10 text-tone-success';
    case 'Declined':
    case 'Rescinded': return 'border-tone-danger/30 bg-tone-danger/10 text-tone-danger';
    case 'Sent': return 'border-tone-info/30 bg-tone-info/10 text-tone-info';
    case 'Pending Approval': return 'border-tone-warning/30 bg-tone-warning/10 text-tone-warning';
    default: return 'border-border bg-muted text-muted-foreground';
  }
};

export function OfferPanel({
  offer,
  applicationId,
  onChanged,
}: {
  offer: Offer | null;
  applicationId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(!offer);
  const [form, setForm] = useState({
    baseSalary: offer?.baseSalary ?? 180000,
    signingBonus: offer?.signingBonus ?? 20000,
    equity: offer?.equity ?? '0.10%',
    level: offer?.level ?? 'L5 — Senior',
    startDate: offer?.startDate ?? '',
    status: (offer?.status ?? 'Draft') as (typeof STATUSES)[number],
    notes: offer?.notes ?? '',
  });

  const save = useMutation({
    mutationFn: () =>
      upsertOffer({
        offerId: offer?.id,
        applicationId,
        status: form.status,
        baseSalary: form.baseSalary,
        signingBonus: form.signingBonus,
        equity: form.equity || undefined,
        level: form.level || undefined,
        startDate: form.startDate || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      setEditing(false);
      onChanged();
      toast.success(offer ? 'Offer updated' : 'Offer created');
    },
    onError: () => toast.error('Could not save that offer'),
  });

  const field = (label: string, node: React.ReactNode) => (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      {node}
    </label>
  );

  const inputCls =
    'w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary/60';

  if (!editing && offer) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${tone(offer.status)}`}>
            {offer.status}
          </span>
          <span className="text-[12.5px] text-muted-foreground">{offer.level}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
          {[
            ['Base salary', money(offer.baseSalary)],
            ['Signing bonus', money(offer.signingBonus)],
            ['Equity', offer.equity ?? '—'],
            ['Start date', offer.startDate ?? '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-[13px] font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {offer.notes && (
          <p className="mt-3 border-t border-border pt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            {offer.notes}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 text-[13px] font-medium">{offer ? 'Edit offer' : 'Create an offer'}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          'Base salary',
          <input
            type="number"
            value={form.baseSalary}
            onChange={(e) => setForm((f) => ({ ...f, baseSalary: Number(e.target.value) }))}
            className={inputCls}
          />,
        )}
        {field(
          'Signing bonus',
          <input
            type="number"
            value={form.signingBonus}
            onChange={(e) => setForm((f) => ({ ...f, signingBonus: Number(e.target.value) }))}
            className={inputCls}
          />,
        )}
        {field(
          'Equity',
          <input
            value={form.equity}
            onChange={(e) => setForm((f) => ({ ...f, equity: e.target.value }))}
            className={inputCls}
          />,
        )}
        {field(
          'Level',
          <input
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
            className={inputCls}
          />,
        )}
        {field(
          'Start date',
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            className={inputCls}
          />,
        )}
        {field(
          'Status',
          <select
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as (typeof STATUSES)[number] }))
            }
            className={inputCls}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>,
        )}
      </div>
      <textarea
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        rows={2}
        placeholder="Notes for the approval chain…"
        className={`mt-3 resize-none ${inputCls}`}
      />
      <p className="mt-2 text-[11px] text-muted-foreground">
        Setting the status to Accepted also marks the candidate as hired.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        {offer && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {save.isPending ? 'Saving…' : offer ? 'Save offer' : 'Create offer'}
        </button>
      </div>
    </div>
  );
}
