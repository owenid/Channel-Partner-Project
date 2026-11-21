import { FormEvent, ReactNode, useState } from 'react';
import { api, useApi } from '../api/client';
import type { EffectiveMode, ModifyOptions, ServiceDetail } from '../api/types';
import { Icon, Modal, fmtDate } from '../components/ui';

/**
 * Shared two-step flow from the wireframes: a form, then a "Confirmation" step
 * with Cancel / OK. Styled like the portal's other dialogs.
 */
function TwoStep({ title, form, confirmText, canProceed, submit, onClose }: {
  title: string; form: ReactNode; confirmText: ReactNode; canProceed: boolean;
  submit: () => Promise<void>; onClose: () => void;
}) {
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const onConfirm = async () => {
    setBusy(true); setError(undefined);
    try { await submit(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (step === 'confirm') {
    return (
      <Modal title="Confirmation" onClose={onClose} width={640}>
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{confirmText}</div>
        {error && <p className="error-text" style={{ marginTop: 16 }}>{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={() => setStep('form')} disabled={busy}>{Icon.chevronLeft()} Cancel</button>
          <button type="button" className="btn btn-teal" onClick={onConfirm} disabled={busy}>{busy ? 'Submitting…' : 'OK'} {Icon.chevronRight()}</button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (canProceed) setStep('confirm'); }}>
        {form}
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{Icon.chevronLeft()} Cancel</button>
          <button type="submit" className="btn btn-teal" disabled={!canProceed}>Proceed {Icon.chevronRight()}</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Modify service (upgrade / downgrade) ----------
export function ModifyServiceModal({ service, onClose, onDone }: { service: ServiceDetail; onClose: () => void; onDone: (s: ServiceDetail) => void }) {
  const opts = useApi<ModifyOptions>(`/services/${service.id}/modify-options`);
  const [productId, setProductId] = useState('');
  const [mode, setMode] = useState<EffectiveMode | ''>('');
  const o = opts.data;
  const product = o?.products.find((p) => p.id === productId);
  const upgrades = o?.products.filter((p) => p.direction === 'upgrade') ?? [];
  const downgrades = o?.products.filter((p) => p.direction === 'downgrade') ?? [];

  const confirmText = mode === 'At the end of bill cycle'
    ? <>Modifying your service to <strong>{product?.name}</strong> will take effect at the end of your current bill cycle (<strong>{fmtDate(o?.billCycleEnd)}</strong>). Please confirm you want to proceed.</>
    : <>Modifying your service to <strong>{product?.name}</strong> will take effect <span style={{ color: 'var(--red)', fontWeight: 700 }}>immediately</span> and may cause a short interruption to the service. Please confirm you want to proceed.</>;

  return (
    <TwoStep
      title="Modify service"
      onClose={onClose}
      canProceed={!!product && !!mode}
      confirmText={confirmText}
      submit={async () => onDone(await api<ServiceDetail>(`/services/${service.id}/modify`, { method: 'POST', body: { productId, effectiveMode: mode, confirmed: true } }))}
      form={
        <>
          {opts.error && <p className="error-text">{opts.error.message}</p>}
          <div className="form-grid">
            <label className="field"><span>Current product</span><input className="input" readOnly value={o?.currentProduct ?? service.serviceName} /></label>
            <label className="field"><span>New product</span>
              <select className="select" required value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!o}>
                <option value="">Select option</option>
                {upgrades.length > 0 && <optgroup label="Upgrade">{upgrades.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                {downgrades.length > 0 && <optgroup label="Downgrade">{downgrades.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
              </select>
            </label>
            <label className="field"><span>Effective mode</span>
              <select className="select" required value={mode} onChange={(e) => setMode(e.target.value as EffectiveMode)}>
                <option value="">Select option</option>
                {(o?.effectiveModes ?? []).map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>
          {product && o && (
            <>
              <hr style={{ margin: '12px 0 22px' }} />
              <h3 style={{ font: '700 14px var(--body)', marginBottom: 16 }}>Change summary</h3>
              <dl className="dl" style={{ gridTemplateColumns: '150px 1fr', rowGap: 8 }}>
                <dt>Change type:</dt><dd style={{ textTransform: 'capitalize' }}>{product.direction} ({o.currentBandwidthMbps} → {product.bandwidthMbps} Mbps)</dd>
                <dt>Service reference:</dt><dd>{service.serviceReference}</dd>
                <dt>Address:</dt><dd>{service.address}, {service.city}, {service.postcode}</dd>
                {mode && <><dt>Takes effect:</dt><dd>{mode === 'Immediately' ? 'Immediately' : `End of bill cycle (${fmtDate(o.billCycleEnd)})`}</dd></>}
              </dl>
            </>
          )}
        </>
      }
    />
  );
}

// ---------- Suspend / unsuspend ----------
export function SuspendServiceModal({ service, onClose, onDone }: { service: ServiceDetail; onClose: () => void; onDone: (s: ServiceDetail) => void }) {
  const reasons = useApi<{ suspend: string[]; unsuspend: string[] }>('/suspension-reasons');
  const [action, setAction] = useState<'suspend' | 'unsuspend'>(service.suspended ? 'unsuspend' : 'suspend');
  const [reason, setReason] = useState('');
  const list = reasons.data?.[action] ?? [];
  const allowed = action === 'suspend' ? !service.suspended : service.suspended;

  const confirmText = action === 'suspend'
    ? <>The selected service <strong>{service.serviceName}</strong> will be suspended <span style={{ color: 'var(--red)', fontWeight: 700 }}>immediately</span> but billing will continue. Are you sure you want to proceed with temporarily suspending the service?</>
    : <>The selected service <strong>{service.serviceName}</strong> will be <strong>restored immediately</strong>. Are you sure you want to proceed with unsuspending the service?</>;

  return (
    <TwoStep
      title="Suspension / unsuspension of services"
      onClose={onClose}
      canProceed={allowed && !!reason}
      confirmText={confirmText}
      submit={async () => onDone(await api<ServiceDetail>(`/services/${service.id}/suspension`, { method: 'POST', body: { action, reason, confirmed: true } }))}
      form={
        <div className="form-grid">
          <label className="field"><span>Service type</span>
            <select className="select" value={action} onChange={(e) => { setAction(e.target.value as 'suspend' | 'unsuspend'); setReason(''); }}>
              <option value="suspend">Suspend service</option>
              <option value="unsuspend">Unsuspend service</option>
            </select>
          </label>
          <label className="field"><span>Current product</span><input className="input" readOnly value={service.serviceName} /></label>
          <label className="field"><span>Reason</span>
            <select className="select" required value={reason} onChange={(e) => setReason(e.target.value)} disabled={!allowed}>
              <option value="">Select option</option>
              {list.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          {!allowed && (
            <p className="error-text full">
              This service is {service.suspended ? 'already suspended' : 'not suspended'}.
            </p>
          )}
        </div>
      }
    />
  );
}
