import { useMemo, useState } from 'react';
import { qs, useApi } from '../api/client';
import type { AppointmentSlot, AppointmentsResponse } from '../api/types';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const slotLabel = (s: AppointmentSlot) =>
  `${day(s.start_datetime_iso)} ${time(s.start_datetime_iso)} - ${time(s.end_datetime_iso)} (${new Date(s.start_datetime_iso).getHours() < 12 ? 'AM' : 'PM'} slot)`;

/**
 * Engineer appointment slots (Engineer Appointments and Reservation design):
 * GET /partner/{product_type}/appointments - GIG only returns confirmed slots.
 */
export function SlotPicker({ productType = 'fttp', addressKey, productCode, postcode, value, onChange }: {
  productType?: string; addressKey: string; productCode: string; postcode?: string;
  value: AppointmentSlot | null; onChange: (s: AppointmentSlot) => void;
}) {
  // fixed once per mount: a fresh timestamp on every render would change the URL and refetch forever
  const [start] = useState(() => new Date().toISOString());
  const res = useApi<AppointmentsResponse>(
    `/partner/${productType}/appointments${qs({ start_datetime_iso: start, address_key: addressKey, product_code: productCode, postcode })}`,
  );
  const byDay = useMemo(() => {
    const m = new Map<string, AppointmentSlot[]>();
    for (const s of res.data?.data ?? []) m.set(day(s.start_datetime_iso), [...(m.get(day(s.start_datetime_iso)) ?? []), s]);
    return [...m];
  }, [res.data]);

  if (res.error) return <p className="error-text">Appointments couldn&apos;t be retrieved from the supplier ({res.error.message}). Try again shortly.</p>;
  if (!res.data) return <div className="skeleton" style={{ height: 120 }} />;
  if (!byDay.length) return <p className="error-text">No appointments are currently available for this address.</p>;
  return (
    <div className="slots" role="radiogroup" aria-label="Preferred appointment">
      {byDay.map(([d, slots]) => (
        <div className="slot-day" key={d}>
          <span>{d}</span>
          {slots.map((s) => {
            const on = value?.start_datetime_iso === s.start_datetime_iso;
            return (
              <button type="button" role="radio" aria-checked={on} key={s.start_datetime_iso} className={`slot ${on ? 'on' : ''}`} onClick={() => onChange(s)}>
                {time(s.start_datetime_iso)} - {time(s.end_datetime_iso)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
