"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, Clock3, FileText, Flag, Laptop, LoaderCircle, LockKeyhole, LogOut, MapPin, Menu, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { localDateString, prettyDate, shortDate } from "@/lib/dates";

type Section = "overview" | "daily" | "checks";
type Status = "todo" | "in_progress" | "done";
type TaskFilter = "all" | "open" | "todo" | "in_progress" | "high" | "overdue" | "done";
type DailyLog = { id: string; log_date: string; activity_time: string; performer_name: string; department: string; location: string; ticket_number: string | null; title: string; details: string };
type FollowupTask = { id: string; title: string; details: string; project: string; deadline: string | null; priority: "low" | "normal" | "high"; status: Status };
type Summary = Record<TaskFilter | "today", number> & { performers: string[]; departments: string[]; department_options: { name: string; initial: string }[]; locations: string[] };
const EMPTY_SUMMARY: Summary = { all: 0, open: 0, todo: 0, in_progress: 0, high: 0, overdue: 0, done: 0, today: 0, performers: [], departments: [], department_options: [], locations: [] };
const EMPTY_FILTERS = { performer: "", department: "", location: "", ticket: "all", from: "", to: "" };
const STATUS_LABELS: Record<Status, string> = { todo: "Belum mulai", in_progress: "Dikerjakan", done: "Selesai" };
const TASK_LABELS: Record<TaskFilter,string> = { all: "Semua", open: "Belum selesai", todo: "Belum mulai", in_progress: "Dikerjakan", high: "Prioritas tinggi", overdue: "Terlambat", done: "Selesai" };
const nav = [{ id: "overview" as const, label: "Ringkasan", icon: Activity }, { id: "daily" as const, label: "Daily Task", icon: FileText }, { id: "checks" as const, label: "Daily Check", icon: ClipboardCheck }];
const LOG_COLUMNS = "id,log_date,activity_time,performer_name,department,location,ticket_number,title,details";
const TASK_COLUMNS = "id,title,details,project,deadline,priority,status";
const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    if (!supabase) { setError("Hubungkan project Supabase dulu lewat konfigurasi environment."); setBusy(false); return; }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError("Email atau password belum cocok. Pastikan akun sudah dibuat di Supabase.");
    else onLogin();
    setBusy(false);
  }

  return <main className="login-page">
    <div className="login-art"><div className="art-glow"/><div className="art-copy"><div className="brand-mark large"><Laptop size={23}/></div><p className="eyebrow light">WORKSPACE PERSONAL</p><h1>Semua kerjaan<br/>rapi, satu tempat.</h1><p className="art-sub">Log aktivitas, cek follow-up dari lead, dan pantau pekerjaan harian dengan tertata.</p><div className="art-check"><span><Check size={14}/></span>Dirancang buat workflow IT Support</div></div><div className="art-bottom"><span>DAILY CHECK</span><span>IT SUPPORT WORKSPACE</span></div></div>
    <div className="login-side"><div className="login-form-wrap"><div className="brand-line"><div className="brand-mark"><Laptop size={20}/></div><span>Daily Check</span></div><div className="login-heading"><p className="eyebrow">SELAMAT DATANG</p><h2>Masuk ke workspace</h2><p>Gunakan akun yang sudah dibuat di Supabase.</p></div>
      {!isSupabaseConfigured && <div className="setup-alert"><CircleHelp size={17}/><span>Supabase belum terhubung. Isi <code>.env.local</code> dengan URL dan publishable key project.</span></div>}
      <form onSubmit={submit} className="login-form"><label>Email kerja<input type="email" autoComplete="username" placeholder="nama@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" placeholder="Masukkan password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error && <p className="form-error">{error}</p>}<button className="primary-btn full" disabled={busy}>{busy ? "Memeriksa..." : "Masuk ke workspace"}<ArrowUpRight size={17}/></button></form>
      <div className="login-security"><LockKeyhole size={15}/><span>Workspace pribadi. Data hanya bisa diakses oleh akun pemiliknya.</span></div><div className="login-foot">Butuh akun? Buat satu dari <strong>Supabase Dashboard → Authentication → Users</strong>.</div>
    </div></div>
  </main>;
}

function Modal({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: React.ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (!busy && e.target === e.currentTarget) onClose(); }} onKeyDown={e => {
    if (e.key === "Escape" && !busy) onClose();
    if (e.key === "Tab") {
      const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }}><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">DAILY CHECK</span><h3 id="modal-title">{title}</h3></div><button className="icon-btn" disabled={busy} aria-label="Tutup" onClick={onClose}><X size={18}/></button></div>{children}</div></div>;
}

export default function Home() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [section, setSection] = useState<Section>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [tasks, setTasks] = useState<FollowupTask[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState<{ kind: "log"; row?: DailyLog } | { kind: "task"; row?: FollowupTask } | null>(null);
  const [deleting, setDeleting] = useState<{ table: "daily_logs" | "followup_tasks"; id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const today = localDateString();
  const userId = user?.id;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setAuthReady(true); });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 3500); return () => clearTimeout(timer); }, [toast]);

  useEffect(() => {
    if (!supabase || !userId) return;
    const db = supabase;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
    async function fetchData() {
      setLoading(true); setLoadError("");
      try {
        const meta = db.rpc("daily_check_summary", { p_today: today }).abortSignal(signal);
        let l = db.from("daily_logs").select(LOG_COLUMNS, { count: "exact" }).eq("user_id", userId!)
          .order("log_date", { ascending: false }).order("activity_time", { ascending: false }).order("id", { ascending: false });
        let t = db.from("followup_tasks").select(TASK_COLUMNS, { count: "exact" }).eq("user_id", userId!)
          .order("deadline", { ascending: true, nullsFirst: false }).order("id");
        if (section === "daily") {
          if (filters.performer) l = l.eq("performer_name", filters.performer);
          if (filters.department) l = l.eq("department", filters.department);
          if (filters.location) l = l.eq("location", filters.location);
          if (filters.from) l = l.gte("log_date", filters.from);
          if (filters.to) l = l.lte("log_date", filters.to);
          if (filters.ticket === "with_ticket") l = l.not("ticket_number", "is", null);
          if (filters.ticket === "without_ticket") l = l.is("ticket_number", null);
        }
        if (section === "overview") t = t.neq("status", "done");
        if (section === "checks") {
          if (taskFilter === "open") t = t.neq("status", "done");
          if (["todo", "in_progress", "done"].includes(taskFilter)) t = t.eq("status", taskFilter);
          if (taskFilter === "high") t = t.eq("priority", "high").neq("status", "done");
          if (taskFilter === "overdue") t = t.lt("deadline", today).neq("status", "done");
        }
        // Quoted filter values prevent commas/parentheses from changing PostgREST syntax.
        const pattern = JSON.stringify(`%${query.replace(/[\\%_]/g, "\\$&")}%`);
        if (query && section === "daily") l = l.or(["title", "details", "performer_name", "department", "location", "ticket_number"].map(c => `${c}.ilike.${pattern}`).join(","));
        if (query && section === "checks") t = t.or(["title", "details", "project"].map(c => `${c}.ilike.${pattern}`).join(","));
        const start = (page - 1) * pageSize;
        const [m, lr, tr] = await Promise.all([
          meta,
          section !== "checks" ? l.range(section === "overview" ? 0 : start, section === "overview" ? 3 : start + pageSize - 1).abortSignal(signal) : null,
          section !== "daily" ? t.range(section === "overview" ? 0 : start, section === "overview" ? 3 : start + pageSize - 1).abortSignal(signal) : null,
        ]);
        if (controller.signal.aborted) return;
        if (m.error || lr?.error || tr?.error) throw new Error("fetch");
        setSummary(m.data as Summary);
        setLogs((lr?.data ?? []) as DailyLog[]); setTasks((tr?.data ?? []) as FollowupTask[]);
        const count = section === "daily" ? lr?.count ?? 0 : tr?.count ?? 0;
        setTotal(count);
        if (section !== "overview" && page > Math.max(1, Math.ceil(count / pageSize))) setPage(Math.max(1, Math.ceil(count / pageSize)));
      } catch { if (!controller.signal.aborted) setLoadError("Data belum bisa dimuat. Periksa koneksi lalu coba lagi."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void fetchData();
    return () => controller.abort();
  }, [userId, section, filters, taskFilter, query, page, pageSize, revision, today]);

  function navigate(next: Section) { setSection(next); setPage(1); setSearch(""); setQuery(""); setMobileNav(false); setLoading(true); }
  function changeFilter(key: keyof typeof filters, value: string) { setFilters(old => ({ ...old, [key]: value })); setPage(1); setLoading(true); }
  function openModal(value: NonNullable<typeof modal>) { setFormError(""); setModal(value); }
  async function mutate(action: () => PromiseLike<{ error: unknown }>, message: string) {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setFormError("");
    try {
      const result = await action();
      if (result.error) throw new Error("save");
      setModal(null); setDeleting(null); setToast(message); setLoading(true); setRevision(n => n + 1);
    } catch { const message = "Belum berhasil disimpan. Periksa koneksi dan coba lagi; isian tetap tersimpan di form."; setFormError(message); if (!modal && !deleting) setToast("Status belum berhasil diperbarui. Coba lagi."); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase || !user || !modal) return;
    const fd = new FormData(e.currentTarget), db = supabase;
    const value = (key: string) => String(fd.get(key) ?? "").trim();
    const title = value("title");
    if (!title) { setFormError("Nama aktivitas atau task tidak boleh kosong."); return; }
    if (modal.kind === "log") {
      const location = normalize(value("location"));
      if (!location || !value("performer_name") || !value("department") || !value("activity_time")) { setFormError("Isi jam, nama petugas, departemen, dan lokasi terlebih dahulu."); return; }
      if (!summary.department_options.some(d => d.name === value("department"))) { setFormError("Pilih departemen dari daftar resmi. Departemen baru tidak diperbolehkan."); return; }
      const payload = { user_id: user.id, title, details: value("details"), log_date: value("log_date"), activity_time: value("activity_time"), performer_name: normalize(value("performer_name")), department: normalize(value("department")), location, ticket_number: value("ticket_number") || null };
      const id = modal.row?.id;
      void mutate(() => id ? db.from("daily_logs").update(payload).eq("id", id).select("id").single() : db.from("daily_logs").insert(payload), id ? "Aktivitas diperbarui." : "Aktivitas dan lokasi tersimpan.");
    } else {
      const payload = { user_id: user.id, title, details: value("details"), project: normalize(value("project")), deadline: value("deadline") || null, priority: value("priority"), status: value("status"), updated_at: new Date().toISOString() };
      const id = modal.row?.id;
      void mutate(() => id ? db.from("followup_tasks").update(payload).eq("id", id).select("id").single() : db.from("followup_tasks").insert(payload), id ? "Task diperbarui." : "Task ditambahkan.");
    }
  }
  async function logout() {
    const result = await supabase?.auth.signOut();
    if (result?.error) { setToast("Belum berhasil keluar. Coba lagi."); return; }
    setUser(null); setLogs([]); setTasks([]); setSummary(EMPTY_SUMMARY); setModal(null); setDeleting(null); setFilters(EMPTY_FILTERS); setSearch(""); setQuery(""); setPage(1);
  }
  function setStatus(task: FollowupTask, status: Status) {
    if (!supabase) return;
    const db = supabase;
    void mutate(() => db.from("followup_tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", task.id).select("id").single(), "Status task diperbarui.");
  }
  const groups = new Map<string, DailyLog[]>();
  logs.forEach(log => groups.set(log.log_date, [...(groups.get(log.log_date) ?? []), log]));
  const current = nav.find(n => n.id === section)!;
  const log = modal?.kind === "log" ? modal.row : undefined;
  const task = modal?.kind === "task" ? modal.row : undefined;
  const taskRows = tasks.map(item => <TaskRow key={item.id} task={item} busy={busy} onStatus={status => setStatus(item, status)} onEdit={() => openModal({ kind: "task", row: item })} onDelete={() => { setFormError(""); setDeleting({ table: "followup_tasks", id: item.id, title: item.title }); }}/>);

  if (!authReady) return <div className="loading-screen"><LoaderCircle className="spin"/><span>Menyiapkan workspace…</span></div>;
  if (!user) return <Login onLogin={() => {}}/>;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}><div className="sidebar-brand"><div className="brand-mark"><Laptop size={20}/></div><div><strong>Daily Check</strong><small>IT Support Workspace</small></div><button className="icon-btn mobile-close" aria-label="Tutup menu" onClick={() => setMobileNav(false)}><X size={18}/></button></div><div className="nav-label">WORKSPACE</div><nav>{nav.map(item => <button key={item.id} className={`nav-item ${item.id === section ? "active" : ""}`} aria-current={item.id === section ? "page" : undefined} onClick={() => navigate(item.id)}><item.icon size={18}/><span>{item.label}</span>{item.id === "checks" && summary.open > 0 && <b>{summary.open}</b>}</button>)}</nav><div className="sidebar-spacer"/><div className="sidebar-note"><ShieldCheck size={20}/><strong>Fokus, satu per satu.</strong><p>Catat hasil kerja. Pantau yang masih perlu diselesaikan.</p></div><div className="profile"><div className="avatar">{user.email?.[0]?.toUpperCase() || "I"}</div><div className="profile-info"><strong>{user.email?.split("@")[0]}</strong><span>{user.email}</span></div><button className="icon-btn" aria-label="Keluar" onClick={logout}><LogOut size={17}/></button></div></aside>
    {mobileNav && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setMobileNav(false)}/>}
    <main className="main-area"><header className="topbar"><div className="topbar-title"><button className="icon-btn mobile-menu" aria-label="Buka navigasi" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div><span className="breadcrumb">Workspace / {current.label}</span><h1>{current.label}</h1></div></div><div className="topbar-right"><button className="icon-btn" disabled={loading} aria-label="Muat ulang data" onClick={() => setRevision(n => n + 1)}><RefreshCw size={17} className={loading ? "spin" : ""}/></button><div className="date-chip"><CalendarDays size={16}/>{prettyDate()}</div></div></header>
    <div className="content-area" key={section}>
      {section === "overview" ? <section className="welcome-banner"><div className="welcome-copy"><div className="welcome-tag"><span className="live-dot"/> RUANG KERJA PRIBADI</div><h2>Halo, {user.email?.split("@")[0]} 👋</h2><p>Satu tempat untuk aktivitas harian dan follow-up dari lead.</p><button className="welcome-btn" onClick={() => openModal({ kind: "log" })}><Plus size={16}/> Catat aktivitas</button></div><ClipboardCheck className="hero-icon" size={110} strokeWidth={1}/></section> : <div className="page-intro"><div><span className="eyebrow">{section === "daily" ? "RIWAYAT PEKERJAAN" : "RENCANA & FOLLOW-UP"}</span><h2>{current.label}</h2><p>{section === "daily" ? "Siapa, di mana, dan kapan. Semua tercatat rapi per tanggal." : "Pantau pekerjaan dari lead, prioritas, dan deadline."}</p></div><button className="primary-btn" onClick={() => openModal({ kind: section === "daily" ? "log" : "task" })}><Plus size={17}/>{section === "daily" ? "Catat aktivitas" : "Tambah task"}</button></div>}
      {section !== "overview" && <div className="filter-panel"><div className="search-field"><Search size={17}/><input aria-label="Cari pekerjaan" placeholder={section === "daily" ? "Cari aktivitas, petugas, lokasi, atau tiket…" : "Cari task, project, atau detail…"} maxLength={120} value={search} onChange={e => setSearch(e.target.value)}/>{search && <button className="icon-btn" aria-label="Hapus pencarian" onClick={() => setSearch("")}><X size={16}/></button>}</div>
        {section === "daily" ? <><div className="filter-grid"><label>Petugas<select value={filters.performer} onChange={e => changeFilter("performer", e.target.value)}><option value="">Semua petugas</option>{summary.performers.map(v => <option key={v}>{v}</option>)}</select></label><label>Departemen<select value={filters.department} onChange={e => changeFilter("department", e.target.value)}><option value="">Semua departemen</option>{summary.department_options.map(d => <option key={d.name} value={d.name}>{d.name} ({d.initial})</option>)}</select></label><label>Lokasi<select value={filters.location} onChange={e => changeFilter("location", e.target.value)}><option value="">Semua lokasi</option>{summary.locations.map(v => <option key={v}>{v}</option>)}</select></label><label>Tiket<select value={filters.ticket} onChange={e => changeFilter("ticket", e.target.value)}><option value="all">Semua tiket</option><option value="with_ticket">Ada tiket</option><option value="without_ticket">Tidak ada tiket</option></select></label><label>Dari tanggal<input type="date" value={filters.from} max={filters.to || undefined} onChange={e => changeFilter("from", e.target.value)}/></label><label>Sampai tanggal<input type="date" value={filters.to} min={filters.from || undefined} onChange={e => changeFilter("to", e.target.value)}/></label></div><div className="filter-footer"><span>Filter berlaku untuk seluruh riwayat aktivitas.</span><button className="text-btn" onClick={() => { setFilters(EMPTY_FILTERS); setSearch(""); setQuery(""); setPage(1); }}>Reset filter</button></div></> : <div className="task-filters">{(Object.keys(TASK_LABELS) as TaskFilter[]).map(key => <button className={`filter-chip ${taskFilter === key ? "active" : ""}`} aria-pressed={taskFilter === key} key={key} onClick={() => { setTaskFilter(key); setPage(1); setLoading(true); }}>{TASK_LABELS[key]} <span>{summary[key]}</span></button>)}</div>}
      </div>}
      {loadError ? <div className="error-banner" role="alert"><CircleHelp size={20}/><span>{loadError}</span><button className="secondary-btn" onClick={() => setRevision(n => n + 1)}>Coba lagi</button></div> : loading ? <LoadingList/> : section === "overview" ? <>
        <div className="stats-grid overview-stats">{[{ title: "Aktivitas hari ini", value: summary.today, icon: FileText, color: "blue", target: "daily" as const }, { title: "Belum selesai", value: summary.open, icon: ClipboardCheck, color: "lavender", target: "checks" as const }, { title: "Lewat deadline", value: summary.overdue, icon: Clock3, color: "peach", target: "checks" as const }, { title: "Task selesai", value: summary.done, icon: CheckCircle2, color: "green", target: "checks" as const }].map((s, i) => <button className="stat-card stat-link" key={s.title} onClick={() => { navigate(s.target); if (i === 0) setFilters({ ...EMPTY_FILTERS, from: today, to: today }); else setTaskFilter(i === 1 ? "open" : i === 2 ? "overdue" : "done"); }}><span className={`stat-icon ${s.color}`}><s.icon size={19}/></span><div className="stat-number">{s.value}</div><div className="stat-label">{s.title}</div><ArrowUpRight size={16} className="stat-arrow"/></button>)}</div>
        <div className="overview-grid"><section className="panel"><div className="panel-heading"><div><h3>Follow-up terdekat</h3><p>Task terbuka, urut deadline.</p></div><button className="icon-btn" aria-label="Lihat semua task" onClick={() => navigate("checks")}><ArrowUpRight size={18}/></button></div>{tasks.length ? <div className="task-list compact">{taskRows}</div> : <EmptyState title="Semua beres" body="Belum ada follow-up terbuka."/>}</section><section className="panel"><div className="panel-heading"><div><h3>Aktivitas terbaru</h3><p>Catatan pekerjaan terakhir.</p></div><button className="icon-btn" aria-label="Lihat semua aktivitas" onClick={() => navigate("daily")}><ArrowUpRight size={18}/></button></div>{logs.length ? logs.map(item => <button className="recent-log" key={item.id} onClick={() => openModal({ kind: "log", row: item })}><div className="activity-icon"><FileText size={17}/></div><div><strong>{item.title}</strong><span>{shortDate(item.log_date)} · {item.activity_time.slice(0, 5)}{item.location ? ` · ${item.location}` : ""}</span></div><ChevronRight size={17}/></button>) : <EmptyState title="Mulai catat pekerjaanmu" body="Aktivitas yang disimpan akan muncul di sini."/>}</section></div>
      </> : <><div className="results-heading"><span><strong>{total}</strong> {section === "daily" ? "aktivitas" : "task"} ditemukan</span>{section === "daily" && <span>{summary.today} aktivitas hari ini</span>}</div>{total === 0 ? <div className="panel"><EmptyState title="Belum ada hasil" body="Coba ubah filter atau tambahkan pekerjaan baru."/></div> : section === "daily" ? <div className="log-days">{[...groups].map(([date, items]) => <section className="log-day" key={date}><div className="day-heading"><div><CalendarDays size={17}/><h3>{prettyDate(new Date(`${date}T12:00:00`))}</h3>{date === today && <span className="today-label">Hari ini</span>}</div><span>{items.length} di halaman ini</span></div>{items.map(item => <article className="work-log" key={item.id}><div className="log-time"><Clock3 size={15}/><strong>{item.activity_time.slice(0, 5)}</strong></div><div className="work-log-body"><h3>{item.title}</h3><div className="log-meta"><span><b>Petugas</b>{item.performer_name || "Belum diisi"}</span><span><b>Departemen</b>{item.department || "Belum diisi"}</span><span><b>Lokasi</b>{item.location || "Belum diisi"}</span><span className={item.ticket_number ? "ticket-tag" : "no-ticket"}>{item.ticket_number ? `Tiket #${item.ticket_number}` : "Tidak ada tiket"}</span></div>{item.details && <p>{item.details}</p>}</div><div className="row-actions"><button className="icon-btn" aria-label={`Edit ${item.title}`} onClick={() => openModal({ kind: "log", row: item })}><Pencil size={16}/></button><button className="icon-btn danger-icon" aria-label={`Hapus ${item.title}`} onClick={() => { setFormError(""); setDeleting({ table: "daily_logs", id: item.id, title: item.title }); }}><Trash2 size={16}/></button></div></article>)}</section>)}</div> : <div className="checks-list">{taskRows}</div>}
        <Pagination page={page} size={pageSize} total={total} onPage={n => { setPage(n); setLoading(true); }} onSize={n => { setPageSize(n); setPage(1); setLoading(true); }}/>
      </>}
    </div></main>
    {modal && <Modal title={modal.kind === "log" ? log ? "Edit aktivitas" : "Catat aktivitas" : task ? "Edit Daily Check" : "Tambah Daily Check"} busy={busy} onClose={() => setModal(null)}><form className="modal-form" onSubmit={save}><fieldset disabled={busy}>
      {modal.kind === "log" && <><div className="form-row"><label>Tanggal<input type="date" name="log_date" defaultValue={log?.log_date || today} required/></label><label>Jam aktivitas<input type="time" name="activity_time" defaultValue={log?.activity_time.slice(0, 5) || ""} required/><small>Isi sesuai waktu pekerjaan dilakukan.</small></label></div><div className="form-row"><label>Nama petugas<input name="performer_name" defaultValue={log?.performer_name ?? user.email?.split("@")[0] ?? ""} maxLength={120} required list="performer-options"/></label><label>Departemen<select name="department" defaultValue={summary.departments.includes(log?.department || "") ? log?.department : ""} required><option value="" disabled>Pilih departemen</option>{summary.department_options.map(d => <option key={d.name} value={d.name}>{d.name} ({d.initial})</option>)}</select><small>{log?.department && !summary.departments.includes(log.department) ? `Departemen lama “${log.department}” belum cocok dengan daftar resmi. Pilih ulang untuk menyimpan perubahan.` : "Pilih dari daftar resmi. Departemen baru tidak dapat ditambahkan."}</small></label></div><datalist id="performer-options">{summary.performers.map(v => <option value={v} key={v}/>)}</datalist><LocationField locations={summary.locations} initial={log?.location || ""}/><label>Nomor tiket <span className="label-optional">(opsional)</span><input name="ticket_number" defaultValue={log?.ticket_number || ""} maxLength={80} placeholder="Kosongkan jika tidak ada tiket"/><small>Tanpa nomor, akan ditampilkan sebagai “Tidak ada tiket”.</small></label></>}
      <label>{modal.kind === "log" ? "Aktivitas" : "Nama task"}<input name="title" defaultValue={log?.title || task?.title || ""} maxLength={160} required placeholder={modal.kind === "log" ? "Contoh: Perbaikan printer Finance" : "Contoh: Pemasangan CCTV ruang server"}/></label>
      {modal.kind === "task" && <><div className="form-row"><label>Project / area<input name="project" defaultValue={task?.project || ""} maxLength={120} placeholder="Contoh: Infrastruktur"/></label><label>Deadline <span className="label-optional">(opsional)</span><input name="deadline" type="date" defaultValue={task?.deadline || ""}/></label></div><div className="form-row"><label>Prioritas<select name="priority" defaultValue={task?.priority || "normal"}><option value="low">Rendah</option><option value="normal">Normal</option><option value="high">Tinggi</option></select></label><label>Status<select name="status" defaultValue={task?.status || "todo"}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div></>}
      <label>Detail pekerjaan<textarea name="details" defaultValue={log?.details || task?.details || ""} maxLength={5000} rows={4} placeholder="Langkah pekerjaan, hasil, atau kendala…"/></label>
      {formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setModal(null)}>Batal</button><button className="primary-btn" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} {busy ? "Menyimpan…" : "Simpan"}</button></div>
    </fieldset></form></Modal>}
    {deleting && <Modal title="Hapus pekerjaan?" busy={busy} onClose={() => setDeleting(null)}><p className="delete-copy">“{deleting.title}” akan dihapus. Tindakan ini tidak bisa dibatalkan.</p>{formError && <p className="form-error" role="alert">Gagal menghapus. Periksa koneksi dan coba lagi.</p>}<div className="modal-actions"><button className="secondary-btn" disabled={busy} onClick={() => setDeleting(null)}>Batal</button><button className="primary-btn danger-btn" disabled={busy} onClick={() => { const db = supabase; if (db) void mutate(() => db.from(deleting.table).delete().eq("id", deleting.id).select("id").single(), "Pekerjaan dihapus."); }}>{busy ? "Menghapus…" : "Ya, hapus"}</button></div></Modal>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}

function LocationField({ locations, initial }: { locations: string[]; initial: string }) {
  const [value, setValue] = useState(initial);
  const [isNew, setIsNew] = useState(Boolean(initial && !locations.includes(initial)));
  const cleaned = normalize(value);
  const match = locations.find(item => normalize(item).toLocaleLowerCase() === cleaned.toLocaleLowerCase());
  return <div className="location-field"><label htmlFor="location-select">Lokasi</label><div className="location-select-wrap"><MapPin size={17}/><select id="location-select" value={isNew ? "new" : value ? `saved:${value}` : ""} required={!isNew} onChange={e => { setIsNew(e.target.value === "new"); setValue(e.target.value === "new" ? "" : e.target.value.replace(/^saved:/, "")); }}><option value="">Pilih lokasi tersimpan</option>{locations.map(item => <option key={item} value={`saved:${item}`}>{item}</option>)}<option value="new">+ Tambah lokasi baru</option></select></div>{isNew && <label className="new-location">Nama lokasi baru<input autoFocus value={value} onChange={e => setValue(e.target.value)} maxLength={160} required placeholder="Contoh: Gudang lantai 1"/><small>{match ? `Lokasi sudah ada. Akan menggunakan “${match}”.` : "Lokasi baru otomatis disimpan saat aktivitas disimpan."}</small></label>}<input type="hidden" name="location" value={match || cleaned}/>{!isNew && <small>Pilih “Tambah lokasi baru” jika lokasi belum tersedia.</small>}</div>;
}
function TaskRow({ task, busy, onStatus, onEdit, onDelete }: { task: FollowupTask; busy: boolean; onStatus: (status: Status) => void; onEdit: () => void; onDelete: () => void }) {
  const overdue = task.deadline && task.deadline < localDateString() && task.status !== "done";
  return <article className={`check-card ${task.status === "done" ? "is-done" : ""}`}><button className={`task-check ${task.status === "done" ? "checked" : ""}`} disabled={busy} aria-label={task.status === "done" ? `Buka kembali ${task.title}` : `Selesaikan ${task.title}`} onClick={() => onStatus(task.status === "done" ? "todo" : "done")}>{task.status === "done" && <Check size={14}/>}</button><div className="check-body"><div className="check-title"><h3>{task.title}</h3><span className={`priority-tag ${task.priority}`}>{task.priority === "high" ? "Prioritas tinggi" : task.priority === "low" ? "Rendah" : "Normal"}</span></div>{task.project && <div className="check-project"><Flag size={13}/>{task.project}</div>}{task.details && <p>{task.details}</p>}<div className="check-bottom"><span className={`deadline ${overdue ? "overdue" : ""}`}><CalendarDays size={14}/>{task.deadline ? shortDate(task.deadline) : "Tanpa deadline"}{overdue && " · Terlambat"}</span><select aria-label={`Status ${task.title}`} className={`status-select ${task.status}`} value={task.status} disabled={busy} onChange={e => onStatus(e.target.value as Status)}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div><div className="row-actions"><button className="icon-btn" disabled={busy} aria-label={`Edit ${task.title}`} onClick={onEdit}><Pencil size={16}/></button><button className="icon-btn danger-icon" disabled={busy} aria-label={`Hapus ${task.title}`} onClick={onDelete}><Trash2 size={16}/></button></div></article>;
}
function EmptyState({ title, body }: { title: string; body: string }) { return <div className="empty-state"><div className="empty-icon"><ClipboardCheck size={24}/></div><h3>{title}</h3><p>{body}</p></div>; }
function LoadingList() { return <div className="loading-list" role="status" aria-label="Memuat pekerjaan"><span className="loading-label"><LoaderCircle className="spin" size={16}/> Memuat pekerjaan…</span>{[1, 2, 3].map(n => <div className="skeleton-card" key={n}><span/><span/><span/></div>)}</div>; }
function Pagination({ page, size, total, onPage, onSize }: { page: number; size: number; total: number; onPage: (n: number) => void; onSize: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <nav className="pagination" aria-label="Halaman hasil"><label>Tampilkan <select aria-label="Jumlah per halaman" value={size} onChange={e => onSize(Number(e.target.value))}>{[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label><span>{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)}` : "0"} dari {total}</span><div><button className="icon-btn" disabled={page <= 1} aria-label="Halaman sebelumnya" onClick={() => onPage(page - 1)}><ChevronLeft size={18}/></button><span>Halaman {page} / {pages}</span><button className="icon-btn" disabled={page >= pages} aria-label="Halaman berikutnya" onClick={() => onPage(page + 1)}><ChevronRight size={18}/></button></div></nav>;
}
