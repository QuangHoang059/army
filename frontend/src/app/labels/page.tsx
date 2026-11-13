'use client';

import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { PageTitle, card, inputCls, labelCls, qrText, useSiteUrl } from '@/components/ui';
import type { Weapon } from '@/lib/types';

/** Cỡ tem (cm). 2×2: dán báng / ốp lót tay — chỉ QR + mã. 4×4: dán hòm / giá súng — thêm tên, số hiệu. */
const SIZES = {
  2: { qr: 1.55, label: '2 × 2 cm (dán trên súng)' },
  4: { qr: 2.9, label: '4 × 4 cm (dán giá / hòm súng)' },
} as const;
type Size = keyof typeof SIZES;

export default function LabelsPage() {
  const { weapons, units, types } = useData();
  const siteUrl = useSiteUrl();
  const [size, setSize] = useState<Size>(2);
  const [unit, setUnit] = useState('');
  const [type, setType] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const list = useMemo(
    () => weapons.filter((w) => !w.retired && (!unit || w.unit === unit) && (!type || w.type === type)),
    [weapons, unit, type],
  );
  const chosen = list.filter((w) => picked.has(w.id));
  const allOn = list.length > 0 && chosen.length === list.length;

  const toggle = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section>
      <div className="no-print">
        <PageTitle
          title="In tem QR hàng loạt"
          sub="Chọn vũ khí và cỡ tem rồi bấm In. Nên in trên giấy decal, bọc băng keo trong / ép plastic chống nước."
        />
        <div className={`${card} mt-4 grid gap-3 p-4 md:grid-cols-4 md:items-end`}>
          <label className={labelCls}>
            Cỡ tem
            <select value={size} onChange={(e) => setSize(Number(e.target.value) as Size)} className={inputCls}>
              {(Object.keys(SIZES) as unknown as Size[]).map((k) => (
                <option key={k} value={k}>
                  {SIZES[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Đơn vị
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
              <option value="">Tất cả</option>
              {units.map((u) => (
                <option key={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Loại
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="">Tất cả</option>
              {types.map((t) => (
                <option key={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button
            disabled={!chosen.length}
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--green)] px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            <Printer size={18} /> In {chosen.length} tem
          </button>
        </div>

        <div className={`${card} mt-3 max-h-[340px] overflow-auto p-2`}>
          <label className="flex items-center gap-2 border-b p-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={allOn}
              onChange={() => setPicked(allOn ? new Set() : new Set(list.map((w) => w.id)))}
            />
            Chọn tất cả ({list.length})
          </label>
          {list.map((w) => (
            <label key={w.id} className="flex items-center gap-2 p-2 text-sm hover:bg-[var(--bg)]">
              <input type="checkbox" checked={picked.has(w.id)} onChange={() => toggle(w.id)} />
              <span className="font-mono font-bold">{w.code}</span> {w.name} • {w.serial}
              <span className="ml-auto text-xs text-[var(--muted)]">{w.unit}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Khi in: chọn khổ A4, tỉ lệ <b>100% (Actual size / Thực tế)</b>, tắt “Vừa trang” để tem đúng kích thước. Xem trước bên dưới.
        </p>
        <h2 className="mt-4 font-display text-lg font-bold uppercase">Xem trước</h2>
      </div>

      <div className="label-sheet mt-2 flex flex-wrap bg-white p-2 text-black">
        {chosen.map((w) => (
          <Label key={w.id} w={w} size={size} siteUrl={siteUrl} />
        ))}
        {!chosen.length && <p className="no-print p-4 text-sm text-gray-500">Chưa chọn vũ khí nào.</p>}
      </div>
    </section>
  );
}

function Label({ w, size, siteUrl }: { w: Weapon; size: Size; siteUrl: string }) {
  const s = SIZES[size];
  return (
    <div
      className="flex flex-col items-center justify-center overflow-hidden border border-dashed border-gray-400"
      style={{ width: `${size}cm`, height: `${size}cm`, breakInside: 'avoid' }}
    >
      <QRCodeSVG value={qrText(w, siteUrl)} level="L" marginSize={0} style={{ width: `${s.qr}cm`, height: `${s.qr}cm` }} />
      <div
        className="mt-[0.5mm] font-mono font-bold leading-none"
        style={{ fontSize: size === 2 ? '5.5pt' : '8pt' }}
      >
        {w.code}
      </div>
      {size === 4 && (
        <div className="mt-[0.5mm] max-w-full truncate px-1 text-center leading-tight" style={{ fontSize: '6.5pt' }}>
          {w.name} • {w.serial}
        </div>
      )}
    </div>
  );
}
