'use client';

import { useCallback, useEffect, useState } from 'react';
import { HardDrive, Lock } from 'lucide-react';
import { AdminOnly } from '@/components/AuthProvider';
import { useData } from '@/components/DataProvider';
import { PageTitle, card, inputCls, labelCls } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/date';
import type { Backup } from '@/lib/types';

const LABEL: Record<string, string> = {
  manual: 'Thủ công',
  auto: 'Tự động',
  'before-clear': 'Trước khi xoá dữ liệu',
  'before-reset': 'Trước khi nạp lại dữ liệu mẫu',
  'before-restore': 'Trước khi khôi phục',
  import: 'Giải mã từ file .vkbak',
};

const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function BackupsPage() {
  return (
    <AdminOnly>
      <Backups />
    </AdminOnly>
  );
}

function Backups() {
  const { busy, run, setFlash } = useData();
  const [data, setData] = useState<{ dir: string; items: Backup[] } | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api
        .backups()
        .then(setData)
        .catch((e) => setFlash({ kind: 'error', text: e.message })),
    [setFlash],
  );
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const b = await run(() => api.createBackup(), (b) => `Đã sao lưu: ${b.name}.`);
    if (b) load();
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle
          title="Sao lưu dữ liệu"
          sub="Mỗi bản gồm toàn bộ cơ sở dữ liệu và ảnh vũ khí. Máy chủ tự sao lưu mỗi ngày và giữ 30 bản gần nhất."
        />
        <button
          disabled={busy}
          onClick={create}
          className="flex items-center gap-2 rounded-xl bg-[var(--green)] px-4 py-3 font-bold text-white shadow disabled:opacity-50"
        >
          <HardDrive /> Sao lưu ngay
        </button>
      </div>

      <div className={`${card} mt-4 p-4 text-sm`}>
        <p>
          Thư mục lưu trên máy chủ: <code className="break-all font-mono font-bold">{data?.dir || '…'}</code>
        </p>
        <p className="mt-2">
          Nên chép định kỳ thư mục này sang ổ khác / USB để phòng hỏng máy. <b>Khôi phục</b>: dừng máy chủ, rồi chạy trong
          thư mục <code className="font-mono">backend</code>:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/80 p-3 text-xs text-white">
          npm run restore{'\n'}npm run restore -- &lt;tên bản sao lưu&gt;
        </pre>
      </div>

      <div className={`${card} mt-3 overflow-x-auto`}>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[var(--green)] text-white">
            <tr>
              <th className="p-3">Thời gian</th>
              <th className="p-3">Loại</th>
              <th className="p-3">Tên bản sao lưu</th>
              <th className="p-3">Dung lượng</th>
              <th className="p-3">Ảnh</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((b) => (
              <tr key={b.name} className="border-t">
                <td className="whitespace-nowrap p-3 font-semibold">{fmtDateTime(b.createdAt)}</td>
                <td className="p-3">{LABEL[b.label.replace(/-+$/, '')] || b.label}</td>
                <td className="p-3 font-mono text-xs">{b.name}</td>
                <td className="p-3">{size(b.size)}</td>
                <td className="p-3">{b.photos}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => setExporting(b.name)}
                    className="flex items-center gap-1 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold hover:border-[var(--green)]"
                  >
                    <Lock size={13} /> Tải bản mã hoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && <p className="p-5 text-center font-semibold">Chưa có bản sao lưu nào.</p>}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Bản mã hoá (.vkbak) dùng AES-256 với mật khẩu bạn đặt — mất USB cũng không đọc được dữ liệu. Khôi phục: chép file
        vào máy chủ, chạy <code>npm run decrypt-backup -- &lt;file.vkbak&gt;</code> rồi <code>npm run restore -- &lt;tên&gt;</code>.
      </p>
      {exporting && <ExportDialog name={exporting} onClose={() => setExporting(null)} />}
    </section>
  );
}

/** Đặt mật khẩu rồi tải bản sao lưu đã mã hoá AES-256 */
function ExportDialog({ name, onClose }: { name: string; onClose: () => void }) {
  const { setFlash } = useData();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr('Mật khẩu tối thiểu 8 ký tự.');
    if (pw !== pw2) return setErr('Hai lần nhập mật khẩu không khớp.');
    setBusy(true);
    setErr(null);
    try {
      const f = await api.exportBackup(name, pw);
      setFlash({ kind: 'ok', text: `Đã tải ${f}. Ghi nhớ mật khẩu — mất mật khẩu thì không giải mã được.` });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className={`${card} w-full max-w-md p-5 shadow-xl`}>
        <h3 className="font-display text-xl font-bold uppercase">Tải bản sao lưu mã hoá</h3>
        <p className="mt-1 font-mono text-xs text-[var(--muted)]">{name}</p>
        <label className={`${labelCls} mt-3 block`}>
          Mật khẩu mã hoá (tối thiểu 8 ký tự)
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="new-password" className={inputCls} />
        </label>
        <label className={`${labelCls} mt-3 block`}>
          Nhập lại mật khẩu
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" className={inputCls} />
        </label>
        {err && <p className="mt-2 text-sm font-semibold text-[var(--red)]">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 font-bold">
            Hủy
          </button>
          <button disabled={busy} className="rounded-xl bg-[var(--green)] px-4 py-2 font-bold text-white disabled:opacity-50">
            {busy ? 'Đang mã hoá…' : 'Tải về'}
          </button>
        </div>
      </form>
    </div>
  );
}
