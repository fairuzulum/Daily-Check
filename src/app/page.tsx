"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BookOpen, Bot, CalendarDays, Check, CheckCheck,
  CheckCircle2, CircleHelp, ClipboardCheck, Clock3, FileText, Flag,
  Laptop, LockKeyhole, LogOut, Menu, Plus, Search, Send, ShieldCheck, Sparkles, StickyNote, X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { localDateString, prettyDate, shortDate } from "@/lib/dates";

type Section = "overview" | "daily" | "checks" | "assistant" | "notes";
type TaskFilter = "all" | "open" | "high" | "done";
type TicketFilter = "all" | "with_ticket" | "without_ticket";
type DailyLog = { id: string; log_date: string; activity_time: string; performer_name: string; department: string; location: string; ticket_number: string | null; title: string; details: string; created_at: string };
type FollowupTask = { id: string; title: string; details: string; project: string; deadline: string | null; priority: "low" | "normal" | "high"; status: "todo" | "in_progress" | "done"; created_at: string };
type WorkNote = { id: string; title: string; body: string; tag: string; updated_at: string };
type AssistantMessage = { question: string; answer: string; sources: { id: string; kind: "activity" | "task"; label: string }[] };

const nav = [
  { id: "overview" as const, label: "Ringkasan", icon: Activity },
  { id: "daily" as const, label: "Daily Task", icon: FileText },
  { id: "checks" as const, label: "Daily Check", icon: ClipboardCheck },
  { id: "assistant" as const, label: "AI Assistant", icon: Bot },
  { id: "notes" as const, label: "Notes", icon: StickyNote },
];

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
    <div className="login-art"><div className="art-glow"/><div className="art-copy"><div className="brand-mark large"><Laptop size={23}/></div><p className="eyebrow light">WORKSPACE PERSONAL</p><h1>Semua kerjaan<br/>rapi, satu tempat.</h1><p className="art-sub">Log aktivitas, cek follow-up dari lead, dan simpan catatan kerja dengan tertata.</p><div className="art-check"><span><Check size={14}/></span>Dirancang buat workflow IT Support</div></div><div className="art-bottom"><span>DAILY CHECK</span><span>IT SUPPORT WORKSPACE</span></div></div>
    <div className="login-side"><div className="login-form-wrap"><div className="brand-line"><div className="brand-mark"><Laptop size={20}/></div><span>Daily Check</span></div><div className="login-heading"><p className="eyebrow">SELAMAT DATANG</p><h2>Masuk ke workspace</h2><p>Gunakan akun yang sudah dibuat di Supabase.</p></div>
      {!isSupabaseConfigured && <div className="setup-alert"><CircleHelp size={17}/><span>Supabase belum terhubung. Isi <code>.env.local</code> dengan URL dan publishable key project.</span></div>}
      <form onSubmit={submit} className="login-form"><label>Email kerja<input type="email" autoComplete="username" placeholder="nama@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" placeholder="Masukkan password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error && <p className="form-error">{error}</p>}<button className="primary-btn full" disabled={busy}>{busy ? "Memeriksa..." : "Masuk ke workspace"}<ArrowUpRight size={17}/></button></form>
      <div className="login-security"><LockKeyhole size={15}/><span>Akses khusus pengguna terdaftar. Jangan gunakan password kantor di Notes.</span></div><div className="login-foot">Butuh akun? Buat satu dari <strong>Supabase Dashboard → Authentication → Users</strong>.</div>
    </div></div>
  </main>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">DAILY CHECK</span><h3>{title}</h3></div><button className="icon-btn" aria-label="Tutup" onClick={onClose}><X size={18}/></button></div>{children}</section></div>;
}

export default function Home() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [section, setSection] = useState<Section>("overview");
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [tasks, setTasks] = useState<FollowupTask[]>([]);
  const [notes, setNotes] = useState<WorkNote[]>([]);
  const [modal, setModal] = useState<"log"|"task"|"note"|null>(null);
  const [editingNote, setEditingNote] = useState<WorkNote|null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [logFilters, setLogFilters] = useState({ performer: "", department: "", location: "", ticket: "all" as TicketFilter });
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");
  const today = localDateString();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { id: session.user.id, email: session.user.email } : null));
    return () => subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    setLoadError("");
    const [l, t, n] = await Promise.all([
      supabase.from("daily_logs").select("id, log_date, activity_time, performer_name, department, location, ticket_number, title, details, created_at").order("log_date", { ascending: false }).order("activity_time", { ascending: false }).limit(300),
      supabase.from("followup_tasks").select("id, title, details, project, deadline, priority, status, created_at").order("deadline", { ascending: true, nullsFirst: false }),
      supabase.from("work_notes").select("id, title, body, tag, updated_at").order("updated_at", { ascending: false }),
    ]);
    const err = l.error || t.error || n.error;
    if (err) { setLoadError("Data belum bisa dimuat. Pastikan migration SQL sudah dijalankan di Supabase."); return; }
    setLogs((l.data || []) as DailyLog[]); setTasks((t.data || []) as FollowupTask[]); setNotes((n.data || []) as WorkNote[]);
  }, [user]);

  useEffect(() => { void Promise.resolve().then(loadData); }, [loadData]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(()=>setToast(""), 2600); return ()=>window.clearTimeout(id); }, [toast]);

  const todayLogs = logs.filter(x=>x.log_date===today);
  const openTasks = tasks.filter(x=>x.status!=="done");
  const doneCount = tasks.filter(x=>x.status==="done").length;
  const overdue = openTasks.filter(x=>x.deadline && x.deadline < today).length;
  const filteredNotes = useMemo(()=>notes.filter(n=>`${n.title} ${n.body} ${n.tag}`.toLowerCase().includes(search.toLowerCase())),[notes,search]);
  const filteredLogs = useMemo(() => logs.filter(log =>
    (!logFilters.performer || log.performer_name === logFilters.performer) &&
    (!logFilters.department || log.department === logFilters.department) &&
    (!logFilters.location || log.location === logFilters.location) &&
    (logFilters.ticket === "all" || (logFilters.ticket === "with_ticket" ? Boolean(log.ticket_number) : !log.ticket_number))
  ), [logs, logFilters]);
  const logFilterOptions = useMemo(() => ({
    performers: [...new Set(logs.map(log => log.performer_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id")),
    departments: [...new Set(logs.map(log => log.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id")),
    locations: [...new Set(logs.map(log => log.location).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id")),
  }), [logs]);
  const groupedLogs = useMemo(() => {
    const grouped = new Map<string, DailyLog[]>();
    for (const log of filteredLogs) grouped.set(log.log_date, [...(grouped.get(log.log_date) ?? []), log]);
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filteredLogs]);
  const filteredTasks = useMemo(() => tasks.filter(task => {
    if (taskFilter === "open") return task.status !== "done";
    if (taskFilter === "high") return task.priority === "high";
    if (taskFilter === "done") return task.status === "done";
    return true;
  }), [tasks, taskFilter]);
  const taskFilterCounts: Record<TaskFilter, number> = {
    all: tasks.length,
    open: openTasks.length,
    high: tasks.filter(task => task.priority === "high").length,
    done: doneCount,
  };

  async function logout() { await supabase?.auth.signOut(); setUser(null); }
  function showModal(kind: "log"|"task"|"note") { setEditingNote(null); setModal(kind); }
  function notify(message: string) { setToast(message); }
  async function removeRow(table: "daily_logs"|"followup_tasks"|"work_notes", id: string) {
    if (!supabase) return;
    const { error } = await supabase.from(table).delete().eq("id",id);
    if (error) notify("Belum berhasil dihapus. Coba lagi."); else { notify("Berhasil dihapus."); loadData(); }
  }
  async function updateTask(task: FollowupTask) {
    if (!supabase) return;
    const status = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    const { error } = await supabase.from("followup_tasks").update({status,updated_at:new Date().toISOString()}).eq("id",task.id);
    if (error) notify("Status belum berhasil diperbarui."); else { notify(status==="done"?"Task selesai. Nice!":"Status task diperbarui."); loadData(); }
  }
  async function saveLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!supabase||!user)return; const fd=new FormData(e.currentTarget);
    const ticketNumber=String(fd.get("ticket_number")||"").trim();
    const {error}=await supabase.from("daily_logs").insert({user_id:user.id,log_date:fd.get("log_date"),activity_time:fd.get("activity_time"),performer_name:fd.get("performer_name"),department:fd.get("department"),location:fd.get("location"),ticket_number:ticketNumber||null,title:fd.get("title"),details:fd.get("details")});
    if(error){notify("Catatan belum tersimpan.");return;} setModal(null);notify("Aktivitas ditambahkan.");loadData();
  }
  async function saveTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!supabase||!user)return;const fd=new FormData(e.currentTarget);
    const {error}=await supabase.from("followup_tasks").insert({user_id:user.id,title:fd.get("title"),details:fd.get("details"),project:fd.get("project"),deadline:fd.get("deadline")||null,priority:fd.get("priority"),status:"todo"});
    if(error){notify("Task belum tersimpan.");return;}setModal(null);notify("Task ditambahkan.");loadData();
  }
  async function saveNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!supabase||!user)return;const fd=new FormData(e.currentTarget);const payload={title:fd.get("title") as string,body:fd.get("body") as string,tag:fd.get("tag") as string,updated_at:new Date().toISOString()};
    const result=editingNote?await supabase.from("work_notes").update(payload).eq("id",editingNote.id):await supabase.from("work_notes").insert({...payload,user_id:user.id});
    if(result.error){notify("Catatan belum tersimpan.");return;}setModal(null);setEditingNote(null);notify(editingNote?"Catatan diperbarui.":"Catatan disimpan.");loadData();
  }
  async function askAssistant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const question=assistantInput.trim();
    if(!supabase||!user||!question||assistantBusy)return;
    setAssistantBusy(true);setAssistantError("");setAssistantInput("");
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error("Sesi login habis. Keluar lalu masuk lagi.");
      const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({question,history:assistantMessages.slice(-4).map(({question,answer})=>({question,answer}))})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"AI belum bisa menjawab. Coba lagi.");
      setAssistantMessages(current=>[...current,{question,answer:result.answer,sources:result.sources||[]}]);
    } catch(error) {
      setAssistantInput(question);
      setAssistantError(error instanceof Error?error.message:"Koneksi ke AI gagal. Coba lagi.");
    } finally { setAssistantBusy(false); }
  }

  if (!authReady) return <div className="loading-screen"><div className="brand-mark"><Laptop size={20}/></div><span>Menyiapkan workspace...</span></div>;
  if (!user) return <Login onLogin={()=>{if(supabase)supabase.auth.getUser().then(({data})=>setUser(data.user?{id:data.user.id,email:data.user.email}:null));}}/>;

  const current = nav.find(x=>x.id===section)!;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?"open":""}`}><div className="sidebar-brand"><div className="brand-mark"><Laptop size={20}/></div><div><strong>Daily Check</strong><small>IT Support Workspace</small></div><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)} aria-label="Tutup menu"><X size={18}/></button></div><div className="nav-label">WORKSPACE</div><nav>{nav.map(item=><button key={item.id} onClick={()=>{setSection(item.id);setMobileNav(false);}} className={`nav-item ${section===item.id?"active":""}`}><item.icon size={18}/><span>{item.label}</span>{item.id==="checks"&&openTasks.length>0&&<b>{openTasks.length}</b>}</button>)}</nav><div className="sidebar-spacer"/><div className="sidebar-note"><div className="secure-icon"><ShieldCheck size={18}/></div><strong>Ruang kerja pribadi</strong><p>Data dibatasi ke akun yang sedang login.</p></div><div className="profile"><div className="avatar">{(user.email?.[0]||"I").toUpperCase()}</div><div className="profile-info"><strong>{user.email?.split("@")[0]||"IT Support"}</strong><span>{user.email}</span></div><button className="icon-btn" title="Keluar" onClick={logout}><LogOut size={17}/></button></div></aside>
    {mobileNav&&<button className="mobile-scrim" onClick={()=>setMobileNav(false)} aria-label="Tutup navigasi"/>}
    <main className="main-area"><header className="topbar"><div className="topbar-title"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)} aria-label="Buka navigasi"><Menu size={20}/></button><div><span className="breadcrumb">Workspace <span>/</span> {current.label}</span><h1>{section==="overview"?"Ringkasan hari ini":current.label}</h1></div></div><div className="topbar-right"><div className="date-chip"><CalendarDays size={16}/><span>{prettyDate()}</span></div><div className="top-avatar">{(user.email?.[0]||"I").toUpperCase()}</div></div></header>
      <div className="content-area">
        {loadError&&<div className="error-banner"><CircleHelp size={17}/>{loadError}</div>}
        {section==="overview"&&<>
          <section className="welcome-banner"><div className="welcome-copy"><div className="welcome-tag"><span className="live-dot"/> WORKSPACE AKTIF</div><h2>Halo, {user.email?.split("@")[0]||"bro"} <span>👋</span></h2><p>Catat yang sudah dikerjakan, pantau follow-up, lanjutkan dengan fokus.</p><button className="welcome-btn" onClick={()=>showModal("log")}><Plus size={16}/> Catat aktivitas</button></div><div className="welcome-illustration"><div className="orb orb-a"/><div className="orb orb-b"/><div className="desk-card"><div className="desk-screen"><span/><span/><span/><div className="screen-line"/><div className="screen-line short"/></div><div className="desk-stand"/></div><div className="float-check"><CheckCircle2 size={19}/></div></div><div className="banner-noise"/></section>
          <div className="section-heading"><div><h2>Overview</h2><p>Gambaran pekerjaanmu hari ini.</p></div><button className="text-btn" onClick={()=>setSection("checks")}>Lihat semua task <ArrowDownRight size={15}/></button></div>
          <div className="stats-grid"><article className="stat-card"><div className="stat-top"><span className="stat-icon lavender"><ClipboardCheck size={18}/></span><span className="stat-trend">{openTasks.length} aktif</span></div><div className="stat-number">{openTasks.length}</div><div className="stat-label">Task perlu follow-up</div><div className="stat-foot"><span>Task yang belum selesai</span><span className="stat-mini">↗</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon green"><CheckCheck size={18}/></span><span className="stat-trend good">Selesai</span></div><div className="stat-number">{doneCount}</div><div className="stat-label">Task dibereskan</div><div className="stat-foot"><span>Total task selesai</span><span className="stat-mini green-text">✓</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon peach"><Clock3 size={18}/></span><span className={`stat-trend ${overdue?"bad":"good"}`}>{overdue?"Perlu dicek":"On track"}</span></div><div className="stat-number">{overdue}</div><div className="stat-label">Lewat deadline</div><div className="stat-foot"><span>Task melewati tanggal</span><span className="stat-mini">!</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><BookOpen size={18}/></span><span className="stat-trend">Hari ini</span></div><div className="stat-number">{todayLogs.length}</div><div className="stat-label">Aktivitas dicatat</div><div className="stat-foot"><span>Log pekerjaan hari ini</span><span className="stat-mini">↗</span></div></article></div>
          <div className="overview-grid"><section className="panel"><div className="panel-heading"><div><h3>Task prioritas</h3><p>Yang paling dekat untuk dikerjakan.</p></div><button className="icon-btn" aria-label="Lihat semua task" onClick={()=>setSection("checks")}><ArrowUpRight size={17}/></button></div>{openTasks.length===0?<EmptyState icon={<CheckCircle2 size={22}/>} title="Semua beres" body="Belum ada task terbuka. Tambahkan follow-up dari lead." action="Tambah task" onAction={()=>showModal("task")}/>:<div className="task-list compact">{openTasks.slice(0,4).map(task=><TaskRow key={task.id} task={task} onToggle={()=>updateTask(task)}/>)}</div>}</section><section className="panel"><div className="panel-heading"><div><h3>Aktivitas terbaru</h3><p>Log kerja terakhir yang kamu catat.</p></div><button className="icon-btn" aria-label="Lihat daily task" onClick={()=>setSection("daily")}><ArrowUpRight size={17}/></button></div>{logs.length===0?<EmptyState icon={<FileText size={21}/>} title="Belum ada aktivitas" body="Mulai catat pekerjaan yang kamu lakukan hari ini." action="Tambah aktivitas" onAction={()=>showModal("log")}/>:<div className="activity-list">{logs.slice(0,4).map(log=><ActivityRow key={log.id} log={log}/>)}</div>}</section></div>
        </>}
        {section==="daily"&&<><PageIntro eyebrow="CATATAN HARIAN" title="Daily Task" desc="Rekam aktivitas kerja lengkap dengan petugas, lokasi, waktu, dan tiket." action="Catat aktivitas" onAction={()=>showModal("log")} icon={<Plus size={16}/>}/><div className="daily-summary"><div className="summary-icon"><CalendarDays size={20}/></div><div><strong>{todayLogs.length} aktivitas hari ini</strong><span>{prettyDate()}</span></div><div className="summary-right">{filteredLogs.length} ditampilkan</div></div>{logs.length===0?<div className="panel"><EmptyState icon={<FileText size={22}/>} title="Belum ada aktivitas" body="Tambahkan catatan pertama tentang pekerjaan yang selesai." action="Tambah aktivitas" onAction={()=>showModal("log")}/></div>:<><div className="log-filters"><label>Petugas<select value={logFilters.performer} onChange={e=>setLogFilters(v=>({...v,performer:e.target.value}))}><option value="">Semua petugas</option>{logFilterOptions.performers.map(value=><option key={value}>{value}</option>)}</select></label><label>Departemen<select value={logFilters.department} onChange={e=>setLogFilters(v=>({...v,department:e.target.value}))}><option value="">Semua departemen</option>{logFilterOptions.departments.map(value=><option key={value}>{value}</option>)}</select></label><label>Lokasi<select value={logFilters.location} onChange={e=>setLogFilters(v=>({...v,location:e.target.value}))}><option value="">Semua lokasi</option>{logFilterOptions.locations.map(value=><option key={value}>{value}</option>)}</select></label><label>Status tiket<select value={logFilters.ticket} onChange={e=>setLogFilters(v=>({...v,ticket:e.target.value as TicketFilter}))}><option value="all">Semua tiket</option><option value="with_ticket">Ada nomor tiket</option><option value="without_ticket">Tidak ada tiket</option></select></label><button className="clear-filters" onClick={()=>setLogFilters({performer:"",department:"",location:"",ticket:"all"})}>Reset filter</button></div>{filteredLogs.length===0?<div className="panel"><EmptyState icon={<Search size={22}/>} title="Aktivitas tidak ditemukan" body="Ubah atau reset filter untuk melihat catatan lainnya." action="Reset filter" onAction={()=>setLogFilters({performer:"",department:"",location:"",ticket:"all"})}/></div>:<div className="log-days">{groupedLogs.map(([date, dayLogs])=><section className="log-day" key={date}><header className="log-day-head"><div className="day-mark"><CalendarDays size={16}/></div><div><h3>{prettyDate(new Date(`${date}T12:00:00`))}</h3><span>{dayLogs.length} aktivitas</span></div>{date===today&&<span className="today-label">Hari ini</span>}</header><div className="log-feed">{dayLogs.map(log=><article className="log-card" key={log.id}><div className="log-timeline"><span/></div><div className="log-content"><div className="log-meta"><span className="time-pill"><Clock3 size={12}/>{log.activity_time?.slice(0,5)||"--:--"}</span><button className="delete-link" onClick={()=>removeRow("daily_logs",log.id)}>Hapus</button></div><h3>{log.title}</h3><div className="log-attributes"><span><strong>Petugas</strong>{log.performer_name||"Belum diisi"}</span><span><strong>Departemen</strong>{log.department||"Belum diisi"}</span><span><strong>Lokasi</strong>{log.location||"Belum diisi"}</span><span><strong>Tiket</strong>{log.ticket_number?`#${log.ticket_number}`:<em className="no-ticket">Tidak ada tiket</em>}</span></div>{log.details&&<p>{log.details}</p>}</div></article>)}</div></section>)}</div>}</>}</>}
        {section==="checks"&&<><PageIntro eyebrow="FOLLOW-UP DARI LEAD" title="Daily Check" desc="Pantau project dan task di luar tiket helpdesk." action="Tambah task" onAction={()=>showModal("task")} icon={<Plus size={16}/>}/><div className="task-toolbar"><div className="task-count"><span className="count-dot"/>{openTasks.length} task belum selesai</div><div className="filter-legend"><span className="priority-dot high"/>Prioritas tinggi<span className="legend-divider"/><span className="priority-dot normal"/>Normal</div></div>{tasks.length===0?<div className="panel"><EmptyState icon={<ClipboardCheck size={22}/>} title="Checklist masih kosong" body="Masukkan task langsung dari lead, termasuk project dan deadline." action="Tambah task pertama" onAction={()=>showModal("task")}/></div>:<><div className="task-filters" role="group" aria-label="Filter task">{([["all","Semua"],["open","Belum selesai"],["high","Prioritas tinggi"],["done","Selesai"]] as [TaskFilter,string][]).map(([key,label])=><button type="button" key={key} className={`filter-chip ${taskFilter===key?"active":""}`} onClick={()=>setTaskFilter(key)} aria-pressed={taskFilter===key}>{label}<span>{taskFilterCounts[key]}</span></button>)}</div>{filteredTasks.length===0?<div className="panel"><EmptyState icon={<ClipboardCheck size={22}/>} title="Tidak ada task di filter ini" body="Coba pilih filter lain untuk melihat task." action="Lihat semua task" onAction={()=>setTaskFilter("all")}/></div>:<div className="checks-list">{filteredTasks.map(task=><TaskRow key={task.id} task={task} onToggle={()=>updateTask(task)} onDelete={()=>removeRow("followup_tasks",task.id)}/>)}</div>}</>}<div className="soft-note"><ShieldCheck size={17}/><span>Tips: catat task kerja tanpa memasukkan password, token, atau detail akses sistem.</span></div></>}
        {section==="assistant"&&<><PageIntro eyebrow="ASISTEN BERDASARKAN DATA" title="AI Assistant" desc="Tanya soal aktivitas harian dan Daily Check yang tersimpan di database." action="Daily Task" onAction={()=>setSection("daily")} icon={<FileText size={16}/>}/><div className="assistant-notice"><div className="assistant-icon"><Sparkles size={18}/></div><div><strong>Jawaban dibatasi ke data kerja akunmu</strong><p>AI hanya membaca Daily Task dan Daily Check milik akun yang sedang login. Notes dan credential tidak dikirim.</p></div></div><section className="assistant-panel"><div className="assistant-heading"><div className="assistant-avatar"><Bot size={19}/></div><div><strong>Asisten Daily Check</strong><span>Gemini · sumber dari database</span></div><span className="assistant-lock"><LockKeyhole size={13}/> Privat</span></div><div className="assistant-chat">{assistantMessages.length===0&&!assistantBusy&&<div className="assistant-welcome"><div className="assistant-welcome-icon"><Sparkles size={20}/></div><h3>Mau cari aktivitas apa?</h3><p>Contoh: “Tanggal 12 November jam berapa aku cek CCTV?” atau “Rangkum task prioritas yang belum selesai.”</p></div>}{assistantMessages.map((message,index)=><div className="chat-turn" key={`${index}-${message.question}`}><div className="chat-question">{message.question}</div><div className="chat-answer"><div className="assistant-avatar small"><Bot size={15}/></div><div><p>{message.answer}</p>{message.sources.length>0&&<div className="chat-sources"><strong>Sumber data</strong>{message.sources.map(source=><span key={source.id}>{source.kind==="activity"?"Aktivitas":"Task"} · {source.label}</span>)}</div>}</div></div></div>)}{assistantBusy&&<div className="chat-answer"><div className="assistant-avatar small"><Bot size={15}/></div><p className="thinking-text"><span/>Sedang mencari catatan yang cocok…</p></div>}</div>{assistantError&&<div className="assistant-error"><CircleHelp size={15}/>{assistantError}</div>}<form className="assistant-form" onSubmit={askAssistant}><input aria-label="Tulis pertanyaan" value={assistantInput} onChange={e=>setAssistantInput(e.target.value)} maxLength={500} placeholder="Tanya tentang aktivitas, tanggal, tiket, atau task…" disabled={assistantBusy}/><button type="submit" className="primary-btn" disabled={assistantBusy||!assistantInput.trim()}>{assistantBusy?"Mencari…":"Tanya AI"}<Send size={15}/></button></form><div className="assistant-footnote">Maksimal 500 karakter per pertanyaan. AI menolak pertanyaan di luar data kerja.</div></section></>}
        {section==="notes"&&<><PageIntro eyebrow="CATATAN KERJA" title="Notes" desc="Simpan prosedur, konteks project, dan pengingat penting." action="Buat catatan" onAction={()=>showModal("note")} icon={<Plus size={16}/>}/><div className="notes-safety"><div className="notes-safety-icon"><LockKeyhole size={18}/></div><div><strong>Jangan simpan password di sini</strong><p>Pakai password manager untuk kredensial. Notes ini untuk catatan kerja non-rahasia.</p></div></div><div className="notes-toolbar"><div className="search-wrap"><Search size={16}/><input placeholder="Cari catatan..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button onClick={()=>setSearch("")} aria-label="Hapus pencarian"><X size={14}/></button>}</div><div className="notes-total">{filteredNotes.length} catatan</div></div>{filteredNotes.length===0?<div className="panel"><EmptyState icon={<StickyNote size={22}/>} title={search?"Catatan tidak ditemukan":"Belum ada catatan"} body={search?"Coba kata kunci lain.":"Buat catatan pertamamu untuk menyimpan konteks kerja."} action={search?undefined:"Buat catatan"} onAction={search?undefined:()=>showModal("note")}/></div>:<div className="notes-grid">{filteredNotes.map(note=><article className="note-card" key={note.id} onClick={()=>{setEditingNote(note);setModal("note");}}><div className="note-card-top"><span className="note-tag">{note.tag||"Umum"}</span><button className="icon-btn note-delete" aria-label="Hapus catatan" onClick={e=>{e.stopPropagation();removeRow("work_notes",note.id);}}><X size={16}/></button></div><h3>{note.title}</h3><p>{note.body||"Belum ada isi."}</p><div className="note-foot"><span><Clock3 size={13}/>{shortDate(note.updated_at?.slice(0,10))}</span><span className="note-edit">Buka catatan <ArrowUpRight size={13}/></span></div></article>)}</div>}</>}
      </div>
    </main>
    {modal==="log"&&<Modal title="Catat aktivitas" onClose={()=>setModal(null)}><form className="modal-form" onSubmit={saveLog}><div className="form-row"><label>Tanggal<input name="log_date" type="date" defaultValue={today} required/></label><label>Jam<input name="activity_time" type="time" defaultValue={new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date())} required/></label></div><label>Nama petugas<input name="performer_name" maxLength={120} defaultValue={user?.email?.split("@")[0]||""} placeholder="Nama yang mengerjakan" required/></label><div className="form-row"><label>Departemen<input name="department" maxLength={120} placeholder="Contoh: IT Support" required/></label><label>Lokasi<input name="location" maxLength={160} placeholder="Contoh: Gudang lantai 1" required/></label></div><label>Nomor tiket <span className="label-optional">(opsional)</span><input name="ticket_number" maxLength={80} placeholder="Kosongkan jika tidak ada tiket"/><small className="field-help">Kalau dikosongkan, status otomatis ditampilkan “Tidak ada tiket”.</small></label><label>Aktivitas<input name="title" maxLength={160} placeholder="Contoh: Cek koneksi printer lantai 2" required/></label><label>Detail singkat<textarea name="details" rows={4} maxLength={5000} placeholder="Apa yang dikerjakan? Ada hasil atau kendala?"/></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setModal(null)}>Batal</button><button className="primary-btn">Simpan aktivitas <ArrowUpRight size={16}/></button></div></form></Modal>}
    {modal==="task"&&<Modal title="Tambah Daily Check" onClose={()=>setModal(null)}><form className="modal-form" onSubmit={saveTask}><label>Nama task<input name="title" maxLength={160} placeholder="Contoh: Ganti telepon ruang meeting" required/></label><div className="form-row"><label>Project / area<input name="project" maxLength={120} placeholder="Contoh: CCTV ruang server"/></label><label>Deadline<input name="deadline" type="date" min={today}/></label></div><div className="form-row"><label>Prioritas<select name="priority" defaultValue="normal"><option value="low">Rendah</option><option value="normal">Normal</option><option value="high">Tinggi</option></select></label><div className="field-spacer"/></div><label>Catatan<textarea name="details" rows={3} maxLength={5000} placeholder="Konteks dari lead atau langkah berikutnya"/></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setModal(null)}>Batal</button><button className="primary-btn">Simpan task <ArrowUpRight size={16}/></button></div></form></Modal>}
    {modal==="note"&&<Modal title={editingNote?"Edit catatan":"Buat catatan"} onClose={()=>{setModal(null);setEditingNote(null);}}><form className="modal-form" onSubmit={saveNote}><label>Judul<input name="title" defaultValue={editingNote?.title||""} maxLength={160} placeholder="Contoh: Checklist setup laptop baru" required/></label><label>Kategori<input name="tag" defaultValue={editingNote?.tag||"Umum"} maxLength={40} placeholder="Contoh: Prosedur, Project, Aset"/></label><label>Isi catatan<textarea name="body" defaultValue={editingNote?.body||""} rows={7} maxLength={10000} placeholder="Tulis catatan kerja yang tidak berisi password atau secret..."/></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>{setModal(null);setEditingNote(null);}}>Batal</button><button className="primary-btn">Simpan catatan <ArrowUpRight size={16}/></button></div></form></Modal>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}

function PageIntro({eyebrow,title,desc,action,onAction,icon}:{eyebrow:string;title:string;desc:string;action:string;onAction:()=>void;icon:React.ReactNode}){return <div className="page-intro"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{desc}</p></div><button className="primary-btn" onClick={onAction}>{icon}{action}</button></div>;}
function EmptyState({icon,title,body,action,onAction}:{icon:React.ReactNode;title:string;body:string;action?:string;onAction?:()=>void}){return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{body}</p>{action&&onAction&&<button className="text-btn" onClick={onAction}>{action}<ArrowUpRight size={15}/></button>}</div>;}
function TaskRow({task,onToggle,onDelete}:{task:FollowupTask;onToggle:()=>void;onDelete?:()=>void}){
  const overdue=task.deadline&&task.deadline<localDateString()&&task.status!=="done";
  return <article className={`task-row ${task.status==="done"?"task-done":""}`}><button className={`task-check ${task.status==="done"?"checked":""}`} aria-label={task.status==="done"?"Tandai belum selesai":"Tandai berikutnya"} onClick={onToggle}>{task.status==="done"?<Check size={14}/>:task.status==="in_progress"?<span/>:null}</button><div className="task-main"><div className="task-title-line"><h4>{task.title}</h4>{task.priority==="high"&&<span className="priority-label">PENTING</span>}</div><div className="task-subline">{task.project&&<span className="project-chip"><Flag size={12}/>{task.project}</span>}{task.details&&<span className="task-details">{task.details}</span>}</div></div><div className={`task-deadline ${overdue?"overdue":""}`}><CalendarDays size={14}/><span>{task.deadline?shortDate(task.deadline):"Tanpa deadline"}</span></div><span className={`status-pill ${task.status}`}>{task.status==="todo"?"Belum mulai":task.status==="in_progress"?"Dikerjakan":"Selesai"}</span>{onDelete&&<button className="icon-btn task-delete" aria-label="Hapus task" onClick={onDelete}><X size={16}/></button>}</article>
}
function ActivityRow({log}:{log:DailyLog}){return <article className="activity-row"><div className="activity-icon"><CheckCircle2 size={16}/></div><div className="activity-main"><strong>{log.title}</strong><p>{log.details||"Aktivitas kerja dicatat."}</p></div><span className="activity-date">{shortDate(log.log_date)}</span></article>;}
