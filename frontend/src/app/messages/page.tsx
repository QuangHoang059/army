'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageSquare, Search, Send } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { PageTitle, card } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/date';
import type { Contact, Message } from '@/lib/types';

const MAX_LEN = 2000;

/** Giờ ngắn gọn: hôm nay → HH:MM, ngày khác → HH:MM DD/MM/YYYY */
function shortTime(s: string) {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return s.slice(0, 10) === ymd ? s.slice(11, 16) : fmtDateTime(s.replace(' ', 'T'));
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

/** Nhắn tin 1-1 giữa các tài khoản. Tự cập nhật tin mới vài giây một lần (không cần Internet ngoài). */
export default function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [seenUpTo, setSeenUpTo] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);
  const selRef = useRef<number | null>(null);
  selRef.current = sel;

  const loadContacts = useCallback(async () => {
    try {
      setContacts(await api.contacts());
      setLoaded(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadContacts();
    const t = setInterval(loadContacts, 10000);
    return () => clearInterval(t);
  }, [loadContacts]);

  /** Lấy tin mới của hội thoại đang mở (chỉ phần sau tin cuối đã có) */
  const pull = useCallback(async (other: number, reset = false) => {
    try {
      const r = await api.conversation(other, reset ? 0 : lastIdRef.current);
      if (selRef.current !== other) return; // đã chuyển sang người khác trong lúc chờ
      if (reset) setMsgs(r.items);
      else if (r.items.length) setMsgs((m) => [...m, ...r.items.filter((x) => !m.some((y) => y.id === x.id))]);
      if (r.items.length) lastIdRef.current = r.items[r.items.length - 1].id;
      setSeenUpTo(r.seenUpTo);
      if (r.items.some((x) => x.fromId === other)) {
        setContacts((cs) => cs.map((c) => (c.id === other ? { ...c, unread: 0 } : c)));
        window.dispatchEvent(new Event('messages:read'));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (sel == null) return;
    lastIdRef.current = 0;
    setMsgs([]);
    setSeenUpTo(0);
    setErr(null);
    pull(sel, true);
    const t = setInterval(() => pull(sel), 4000);
    return () => clearInterval(t);
  }, [sel, pull]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length, sel]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sel == null || sending) return;
    setSending(true);
    setErr(null);
    try {
      await api.sendMessage(sel, body);
      setText('');
      await pull(sel);
      loadContacts();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const other = contacts.find((c) => c.id === sel) || null;
  const kw = q.trim().toLowerCase();
  const shown = kw
    ? contacts.filter((c) => `${c.fullName} ${c.username} ${c.unitLabel}`.toLowerCase().includes(kw))
    : contacts;
  const lastMine = [...msgs].reverse().find((m) => m.fromId === user?.id);

  return (
    <div>
      <PageTitle title="Tin nhắn" sub="Nhắn tin trực tiếp giữa các tài khoản trong hệ thống" />

      <div className={`${card} grid h-[calc(100dvh-290px)] min-h-[420px] md:h-[calc(100vh-230px)] md:min-h-[460px] grid-cols-1 overflow-hidden md:grid-cols-[300px_minmax(0,1fr)]`}>
        {/* Danh bạ */}
        <div className={`min-h-0 flex-col border-r border-[var(--line)] ${sel != null ? 'hidden md:flex' : 'flex'}`}>
          <div className="border-b border-[var(--line)] p-3">
            <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2">
              <Search size={16} className="text-[var(--muted)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm người nhận…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loaded && shown.length === 0 && (
              <p className="p-4 text-sm text-[var(--muted)]">
                {contacts.length === 0 ? 'Chưa có tài khoản nào khác để nhắn tin.' : 'Không tìm thấy.'}
              </p>
            )}
            {shown.map((c) => (
              <button
                key={c.id}
                onClick={() => setSel(c.id)}
                className={`flex w-full items-center gap-3 border-b border-[var(--line)] px-3 py-3 text-left hover:bg-[var(--green-soft)] ${
                  sel === c.id ? 'bg-[var(--green-soft)]' : ''
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--green)] text-sm font-bold text-white">
                  {initials(c.fullName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={`truncate text-sm ${c.unread ? 'font-extrabold' : 'font-bold'}`}>{c.fullName}</span>
                    {c.role === 'admin' && (
                      <span className="rounded bg-[var(--gold)] px-1 text-[9px] font-bold uppercase text-black">Admin</span>
                    )}
                    {c.last && <span className="ml-auto shrink-0 text-[11px] text-[var(--muted)]">{shortTime(c.last.createdAt)}</span>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={`truncate text-xs ${c.unread ? 'font-bold' : 'text-[var(--muted)]'}`}>
                      {c.last ? `${c.last.mine ? 'Bạn: ' : ''}${c.last.body}` : c.unitLabel || `@${c.username}`}
                    </span>
                    {c.unread > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-[var(--red)] px-1.5 text-[11px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Hội thoại */}
        <div className={`min-h-0 flex-col ${sel != null ? 'flex' : 'hidden md:flex'}`}>
          {!other ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-[var(--muted)]">
              <MessageSquare size={40} />
              <p className="font-semibold">Chọn một người bên trái để bắt đầu nhắn tin.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-2.5">
                <button onClick={() => setSel(null)} className="rounded p-1.5 hover:bg-[var(--green-soft)] md:hidden" aria-label="Quay lại">
                  <ArrowLeft size={18} />
                </button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--green)] text-sm font-bold text-white">
                  {initials(other.fullName)}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-bold">{other.fullName}</div>
                  <div className="truncate text-xs text-[var(--muted)]">
                    @{other.username}
                    {other.unitLabel && ` • ${other.unitLabel}`}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[var(--bg)] p-3">
                {msgs.length === 0 && (
                  <p className="pt-6 text-center text-sm text-[var(--muted)]">Chưa có tin nhắn. Gửi tin đầu tiên bên dưới.</p>
                )}
                {msgs.map((m, i) => {
                  const mine = m.fromId === user?.id;
                  const prev = msgs[i - 1];
                  const newDay = !prev || prev.createdAt.slice(0, 10) !== m.createdAt.slice(0, 10);
                  return (
                    <div key={m.id}>
                      {newDay && (
                        <div className="my-2 text-center text-[11px] font-bold text-[var(--muted)]">
                          {fmtDateTime(m.createdAt.replace(' ', 'T')).slice(6)}
                        </div>
                      )}
                      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            mine ? 'rounded-br-sm bg-[var(--green)] text-white' : 'rounded-bl-sm border border-[var(--line)] bg-[var(--surface)]'
                          }`}
                        >
                          {m.body}
                          <div className={`mt-0.5 text-right text-[10px] ${mine ? 'text-green-100' : 'text-[var(--muted)]'}`}>
                            {m.createdAt.slice(11, 16)}
                          </div>
                        </div>
                      </div>
                      {mine && m.id === lastMine?.id && seenUpTo >= m.id && (
                        <div className="mt-0.5 text-right text-[11px] text-[var(--muted)]">Đã xem</div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} className="border-t border-[var(--line)] p-2.5">
                {err && <p className="mb-1.5 text-sm font-semibold text-[var(--red)]">{err}</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder="Nhập tin nhắn… (Enter để gửi, Shift+Enter xuống dòng)"
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-[var(--line)] p-2.5 text-sm"
                  />
                  <button
                    disabled={!text.trim() || sending}
                    className="flex h-11 items-center gap-1.5 rounded-xl bg-[var(--green)] px-4 font-bold text-white disabled:opacity-50"
                  >
                    <Send size={16} /> Gửi
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
