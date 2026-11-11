'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Alerts, Loan, Maintenance, Stats, Weapon, WeaponType } from '@/lib/types';

interface Flash {
  kind: 'ok' | 'error';
  text: string;
}

interface DataCtx {
  weapons: Weapon[];
  maintenance: Maintenance[];
  loans: Loan[];
  stats: Stats | null;
  /** Danh mục loại vũ khí (admin quản lý ở trang Loại trang bị) */
  types: WeaponType[];
  alerts: Alerts;
  loading: boolean;
  error: string | null;
  busy: boolean;
  flash: Flash | null;
  reload: () => Promise<void>;
  setFlash: (f: Flash | null) => void;
  /** Run a mutation: sets busy, reloads data, shows success/error flash. */
  run: <T>(fn: () => Promise<T>, okMsg?: string | ((r: T) => string)) => Promise<T | undefined>;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [types, setTypes] = useState<WeaponType[]>([]);
  const [alerts, setAlerts] = useState<Alerts>({ overdue: [], soon: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);

  const fetchAll = useCallback(async () => {
    const [w, m, l, s, a, t] = await Promise.all([
      api.weapons(),
      api.maintenance(),
      api.loans(),
      api.stats(),
      api.alerts(),
      api.weaponTypes(),
    ]);
    setWeapons(w);
    setMaintenance(m);
    setLoans(l);
    setStats(s);
    setAlerts(a);
    setTypes(t);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [fetchAll]);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, okMsg?: string | ((r: T) => string)) => {
      setBusy(true);
      try {
        const r = await fn();
        await fetchAll();
        if (okMsg) setFlash({ kind: 'ok', text: typeof okMsg === 'function' ? okMsg(r) : okMsg });
        return r;
      } catch (e) {
        setFlash({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [fetchAll],
  );

  return (
    <Ctx.Provider
      value={{ weapons, maintenance, loans, stats, types, alerts, loading, error, busy, flash, reload, setFlash, run }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData must be used inside DataProvider');
  return c;
}
