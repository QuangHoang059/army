'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Flag, Play, Printer, Trash2, Undo2 } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { useAuth } from '@/components/AuthProvider';
import { CameraScanner } from '@/components/CameraScanner';
import { PageTitle, StatusBadge, card, inputCls, labelCls } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/date';
import type { Check, CheckDetail, CheckItem } from '@/lib/types';

type Filter = 'all' | 'todo' | 'done';

/**
 * Kiểm đếm vũ khí bằng quét QR:
 * bắt đầu đợt → bật camera quét liên tục từng tem (hoặc tick tay) → kết thúc → kết quả có mặt / đang mượn / thiếu.
 */
export default function InventoryPage() {
  const { units, setFlash, reload } = useData();
  const { isAdmin } = useAuth();
  const [list, setList] = useState<Check[]>([]);
  const [cur, setCur] = useState<CheckDetail | null>(null);
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('todo');
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const [manual, setManual] = useState('');
  const curRef = useRef<CheckDetail | null>(null);
  curRef.current = cur;

  const fail = useCallback((e: unknown) => setFlash({ kind: 'error', text: e instanceof Error ? e.message : String(e) }), [setFlash]);

  const loadList = useCallback(async () => {
    try {
      const l = await api.checks();
      setList(l);
      return l;
    } catch (e) {
      fail(e);
      return [];
    }
  }, [fail]);

  const open = useCallback(
    async (id: number) => {
      try {
        setCur(await api.check(id));
        setLast(null);
      } catch (e) {
        fail(e);
      }
    },
    [fail],
  );

  // Vào trang: có đợt đang mở → mở luôn
  useEffect(() => {
    loadList().then((l) => {
      const o = l.find((c) => !c.finishedAt);
      if (o) open(o.id);
    });
  }, [loadList, open]);

  const start = async () => {
    setBusy(true);
    try {
      const c = await api.startCheck({ unit, note });
      setNote('');
      await open(c.id);
      loadList();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /** Ghi nhận 1 khẩu (quét tem hoặc tick tay) — cập nhật tại chỗ, không tải lại cả danh sách */
  const mark = useCallback(
    async (key: string, method: 'qr' | 'tay') => {
      const c = curRef.current;
      if (!c || c.finishedAt) return;
      try {
        const { item, already } = await api.checkScan(c.id, key, method);
        setCur((p) => {
          if (!p || p.id !== c.id) return p;
          const items = p.items.map((x) => (x.weaponId === item.weaponId ? item : x));
          return { ...p, items, ...count(items) };
        });
        setLast({ ok: true, text: `${already ? 'Đã kiểm trước đó' : 'Có mặt'}: ${item.name} • ${item.serial} • ${item.code}` });
      } catch (e) {
        navigator.vibrate?.([60, 60, 60]);
        setLast({ ok: false, text: e instanceof Error ? e.message : String(e) });
      }
    },
    [],
  );

  const onScan = useCallback((text: string) => mark(text, 'qr'), [mark]);

  const uncheck = async (it: CheckItem) => {
    if (!cur) return;
    try {
      await api.checkUncheck(cur.id, it.weaponId);
      setCur((p) => {
        if (!p) return p;
        const items = p.items.map((x) =>
          x.weaponId === it.weaponId ? { ...x, checkedAt: null, method: null, checkedBy: null } : x,
        );
        return { ...p, items, ...count(items) };
      });
    } catch (e) {
      fail(e);
    }
  };

  const finish = async () => {
    if (!cur) return;
    const miss = cur.missing;
    if (miss > 0 && !confirm(`Còn ${miss} vũ khí chưa kiểm (không đang mượn). Vẫn kết thúc và ghi nhận THIẾU?`)) return;
    setBusy(true);
    try {
      await api.finishCheck(cur.id);
      await open(cur.id);
      loadList();
      reload();
      setFlash({ kind: miss ? 'error' : 'ok', text: miss ? `Đã kết thúc — thiếu ${miss} vũ khí.` : 'Đã kết thúc — đủ quân số vũ khí.' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Check) => {
    if (!confirm(`Xoá đợt kiểm đếm #${c.id}?`)) return;
    try {
      await api.deleteCheck(c.id);
      if (cur?.id === c.id) setCur(null);
      loadList();
    } catch (e) {
      fail(e);
    }
  };

  const shown = useMemo(() => {
    if (!cur) return [];
    if (filter === 'todo') return cur.items.filter((x) => !x.checkedAt);
    if (filter === 'done') return cur.items.filter((x) => x.checkedAt);
    return cur.items;
  }, [cur, filter]);

  const openCheck = list.find((c) => !c.finishedAt);

  return (
    <section>
      <PageTitle
        title="Kiểm đếm vũ khí"
        sub="Bắt đầu đợt kiểm đếm, bật camera rồi lần lượt quét tem QR từng khẩu — hệ thống tự đánh dấu và báo khẩu còn thiếu."
      />

      {!cur && (
        <div className={`${card} mt-4 grid gap-3 p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end`}>
          <label className={labelCls}>
            Đơn vị kiểm đếm
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
              <option value="">Tất cả vũ khí đang quản lý</option>
              {units.map((u) => (
                <option key={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Ghi chú (vd: Kiểm đếm sáng thứ Hai, ca gác 2…)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={inputCls} />
          </label>
          <button
            disabled={busy || !!openCheck}
            onClick={start}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            <Play size={18} /> Bắt đầu kiểm đếm
          </button>
        </div>
      )}

      {cur && (
        <>
          <div className={`${card} mt-4 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold uppercase">
                  Đợt #{cur.id} {cur.unit && `• ${cur.unit}`}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Bắt đầu {fmtDateTime(cur.startedAt)} • {cur.startedBy}
                  {cur.finishedAt && ` • Kết thúc ${fmtDateTime(cur.finishedAt)}`}
                  {cur.note && ` • ${cur.note}`}
                </p>
              </div>
              <div className="no-print flex flex-wrap gap-2">
                {!cur.finishedAt ? (
                  <button
                    disabled={busy}
                    onClick={finish}
                    className="flex items-center gap-2 rounded-xl bg-[var(--red)] px-4 py-2 font-bold text-white disabled:opacity-50"
                  >
                    <Flag size={16} /> Kết thúc
                  </button>
                ) : (
                  <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border px-4 py-2 font-bold">
                    <Printer size={16} /> In kết quả
                  </button>
                )}
                <button onClick={() => setCur(null)} className="rounded-xl border px-4 py-2 font-bold">
                  Đóng
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Tổng số" v={cur.total} cls="bg-[var(--green)]" />
              <Stat label="Có mặt" v={cur.checked} cls="bg-emerald-600" />
              <Stat label="Đang mượn" v={cur.borrowed} cls="bg-sky-700" />
              <Stat label={cur.finishedAt ? 'Thiếu' : 'Chưa kiểm'} v={cur.missing} cls="bg-[var(--red)]" />
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${cur.total ? Math.round(((cur.checked + cur.borrowed) / cur.total) * 100) : 0}%` }}
              />
            </div>
          </div>

          {!cur.finishedAt && (
            <div className="no-print mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
              <div className="rounded-2xl border-4 border-dashed border-[var(--green)] bg-black p-4 text-center text-white">
                <CameraScanner continuous onResult={onScan} />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manual.trim()) mark(manual.trim(), 'tay');
                    setManual('');
                  }}
                  className="mx-auto mt-4 flex max-w-[300px] gap-2 rounded-xl bg-white p-3"
                >
                  <input
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder="Nhập mã QRCB-xxx / số hiệu"
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white p-2.5 font-mono uppercase text-black"
                  />
                  <button className="rounded-lg bg-[var(--green)] px-4 py-2 font-bold text-white">Ghi</button>
                </form>
              </div>
              <div
                className={`flex min-h-[120px] items-center justify-center rounded-2xl border-2 p-4 text-center text-lg font-bold ${
                  !last
                    ? 'border-dashed text-[var(--muted)]'
                    : last.ok
                      ? 'border-emerald-500 bg-[var(--green-soft)]'
                      : 'border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]'
                }`}
              >
                {last ? last.text : 'Kết quả quét sẽ hiện ở đây. Quét xong khẩu này đưa ngay khẩu tiếp theo vào khung.'}
              </div>
            </div>
          )}

          <div className="no-print mt-4 flex flex-wrap gap-2">
            {(
              [
                ['todo', `Chưa kiểm (${cur.total - cur.checked})`],
                ['done', `Đã kiểm (${cur.checked})`],
                ['all', `Tất cả (${cur.total})`],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                  filter === k ? 'border-[var(--green)] bg-[var(--green)] text-white' : 'bg-[var(--surface)]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className={`${card} mt-3 overflow-x-auto`}>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[var(--bg)] text-left text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="p-3">Mã</th>
                  <th className="p-3">Vũ khí</th>
                  <th className="p-3">Đơn vị • Người phụ trách</th>
                  <th className="p-3">Lúc bắt đầu</th>
                  <th className="p-3">Kết quả</th>
                  <th className="no-print p-3" />
                </tr>
              </thead>
              <tbody>
                {(cur.finishedAt ? cur.items : shown).map((it) => {
                  const lent = !it.checkedAt && it.statusAtStart === 'Đang mượn';
                  return (
                    <tr key={it.weaponId} className="border-t">
                      <td className="p-3 font-mono font-bold">{it.code}</td>
                      <td className="p-3">
                        {it.name}
                        <div className="text-xs text-[var(--muted)]">{it.serial}</div>
                      </td>
                      <td className="p-3">
                        {it.unit}
                        <div className="text-xs text-[var(--muted)]">{it.responsible}</div>
                      </td>
                      <td className="p-3">
                        <StatusBadge s={it.statusAtStart} />
                      </td>
                      <td className="p-3">
                        {it.checkedAt ? (
                          <span className="font-bold text-emerald-700">
                            <CheckCircle2 size={14} className="mr-1 inline" />
                            Có mặt {it.checkedAt.slice(11, 16)} {it.method === 'tay' ? '(nhập tay)' : '(QR)'}
                          </span>
                        ) : lent ? (
                          <span className="font-bold text-sky-700">Đang mượn</span>
                        ) : (
                          <span className="font-bold text-[var(--red)]">{cur.finishedAt ? 'THIẾU' : 'Chưa kiểm'}</span>
                        )}
                      </td>
                      <td className="no-print p-3 text-right">
                        {!cur.finishedAt &&
                          (it.checkedAt ? (
                            <button
                              onClick={() => uncheck(it)}
                              title="Bỏ đánh dấu"
                              className="rounded-lg border p-2 text-[var(--muted)]"
                            >
                              <Undo2 size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => mark(it.code, 'tay')}
                              className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold hover:border-[var(--green)]"
                            >
                              Tick tay
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!cur.finishedAt && shown.length === 0 && (
              <p className="p-4 text-center text-sm font-semibold text-[var(--muted)]">
                {filter === 'todo' ? 'Đã kiểm hết — bấm “Kết thúc”.' : 'Không có vũ khí nào.'}
              </p>
            )}
          </div>
        </>
      )}

      <h2 className="no-print mt-6 flex items-center gap-2 font-display text-lg font-bold uppercase">
        <ClipboardCheck size={20} /> Các đợt kiểm đếm
      </h2>
      <div className="no-print mt-3 grid gap-2">
        {list.length === 0 && <p className="text-sm text-[var(--muted)]">Chưa có đợt kiểm đếm nào.</p>}
        {list.map((c) => (
          <article key={c.id} className={`${card} flex flex-wrap items-center gap-3 p-3`}>
            <div className="min-w-[220px] flex-1">
              <b>
                #{c.id} {c.unit || 'Tất cả đơn vị'}
              </b>{' '}
              <span className="text-xs text-[var(--muted)]">{c.note}</span>
              <div className="text-xs text-[var(--muted)]">
                {fmtDateTime(c.startedAt)} • {c.startedBy}
              </div>
            </div>
            <span className="text-sm font-bold">
              {c.checked}/{c.total} có mặt
              {c.borrowed > 0 && ` • ${c.borrowed} mượn`}
            </span>
            {c.finishedAt ? (
              <span
                className={`rounded-full px-2 py-1 text-xs font-bold text-white ${c.missing ? 'bg-[var(--red)]' : 'bg-emerald-600'}`}
              >
                {c.missing ? `Thiếu ${c.missing}` : 'Đủ'}
              </span>
            ) : (
              <span className="rounded-full bg-[var(--amber)] px-2 py-1 text-xs font-bold text-white">Đang kiểm</span>
            )}
            <button onClick={() => open(c.id)} className="rounded-lg border px-3 py-1.5 text-sm font-bold">
              {c.finishedAt ? 'Xem' : 'Tiếp tục'}
            </button>
            {isAdmin && (
              <button onClick={() => remove(c)} title="Xoá" className="rounded-lg border p-2 text-[var(--red)]">
                <Trash2 size={15} />
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function count(items: CheckItem[]) {
  const checked = items.filter((x) => x.checkedAt).length;
  const borrowed = items.filter((x) => !x.checkedAt && x.statusAtStart === 'Đang mượn').length;
  return { checked, borrowed, missing: items.length - checked - borrowed, total: items.length };
}

function Stat({ label, v, cls }: { label: string; v: number; cls: string }) {
  return (
    <div className={`rounded-xl p-3 text-white ${cls}`}>
      <div className="text-2xl font-black">{v}</div>
      <div className="text-xs font-bold uppercase opacity-90">{label}</div>
    </div>
  );
}
