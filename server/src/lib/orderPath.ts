/**
 * "Property / Status Bar Infographic" rules from the Orders Placed View design.
 * Input: the latest order_line_stage and state from the Order Status Updates DB.
 */
export type StepState = 'done' | 'partial' | 'todo' | 'error' | 'warn';
export type PathKind = 'normal' | 'rejected' | 'cancelled' | 'delayed' | 'on-hold';
export interface StatusPath { kind: PathKind; steps: { label: string; state: StepState }[] }

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[\s_-]+/g, '');

export function statusPath(stage: string | null | undefined, state: string | null | undefined): StatusPath {
  const st = norm(stage), done = norm(state) === 'completed';
  const exception = (kind: PathKind, label: string, s: StepState): StatusPath => ({
    kind, steps: [{ label: 'Order placed', state: 'done' }, { label: 'Order processing', state: 'done' }, { label, state: s }],
  });
  if (st === 'orderrejected' || st === 'rejected') return exception('rejected', 'Rejected', 'error');
  if (st === 'cancelled' || st === 'canceled') return exception('cancelled', 'Cancelled', 'error');
  if (st === 'delayed') return exception('delayed', 'Delayed', 'warn');
  if (st === 'onhold') return exception('on-hold', 'On hold', 'warn');

  // Normal Order Path
  const labels = ['Order placed', 'Order processing', 'Installation scheduled', 'Order completed'];
  let reached = 0;                              // {anything else} -> 'Order placed'
  if (st === 'weborder') reached = 1;           // -> 'Order processing'
  if (st === 'confirmedkci2') reached = 2;      // -> 'Installation scheduled' ("Confirmed-KCI2" / "Confirmed KCI-2")
  if (st === 'fulfilled') reached = done ? 3 : 2;
  return {
    kind: 'normal',
    steps: labels.map((label, i) => ({
      label,
      // Fulfilled but not yet Completed sits between 'Installation scheduled' and 'Order completed'
      state: i <= reached ? 'done' : i === 3 && st === 'fulfilled' && !done ? 'partial' : 'todo',
    })),
  };
}

/** Order status shown in tables/badges, derived from the stage when ServiceNow gives no explicit status. */
export function statusLabel(stage: string | null | undefined, state: string | null | undefined): string {
  const p = statusPath(stage, state);
  if (p.kind === 'rejected') return 'Rejected';
  if (p.kind === 'cancelled') return 'Cancelled';
  if (p.kind === 'delayed') return 'Delayed';
  if (p.kind === 'on-hold') return 'On hold';
  const last = p.steps.filter((s) => s.state === 'done').at(-1)?.label;
  return last === 'Order completed' ? 'Completed' : last === 'Installation scheduled' ? 'Scheduled' : 'In progress';
}
