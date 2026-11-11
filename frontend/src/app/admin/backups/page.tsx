'use client';

import { useCallback, useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { AdminOnly } from '@/components/AuthProvider';
import { useData } from '@/components/DataProvider';
import { PageTitle, card } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/date';
import type { Backup } from '@/lib/types';

const LABEL: Record<string, string> = {
  manual: 'Thủ công',
  auto: 'Tự động',
  'before-clear': 'Trước khi xoá dữ liệu',
  'before-reset': 'Trước khi nạp lại dữ liệu mẫu',
  'before-restore': 'Trước khi khôi phục',
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
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && <p className="p-5 text-center font-semibold">Chưa có bản sao lưu nào.</p>}
      </div>
    </section>
  );
}
