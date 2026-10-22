"use client";
import {useEffect,useMemo,useRef,useState} from "react";
type Template={id:number;title:string;unit:string;frequency:string;generationDay:number;dueOffsetDays:number;startDate:string;status:"Aktif"|"Dijeda"|"Nonaktif";picEmails:string};
type Task={id:number;title:string;unit:string;picEmails:string;picNames?:string[];priority:string;outputType:string;sourcePerformanceAgreementId:number|null;sourcePerformanceIndicatorId:number|null;sourcePkLabel?:string;createdBy:string;approvalStatus:string;approvalNote:string;deadline:string;extendedDeadline:string;status:string;progress:number;output:string;notes:string;verificationStatus:string;recurringTemplateId:number|null};
type ProgressUpdate={id:number;employeeEmail:string;progress:number;outputRealization:string;completedActivities:string;obstacles:string;notes:string;createdAt:string};
type Assignee={id:number;fullName:string;email:string;position:string;unit:string;isSelf:boolean};type OrgUnit={id:number;name:string;type:string};
type PerformanceSource={agreementId:number;indicatorId:number;year:number;agreementTitle:string;agreementLevel:string;ownerName:string;ownerPosition:string;unit?:string;objective:string;indicator:string;target:string};
const fresh=()=>({mode:"Sekali" as "Sekali"|"Berulang",title:"",unit:"",picEmails:[] as string[],priority:"Sedang",outputType:"Dokumen",sourcePerformanceAgreementId:null as number|null,sourcePerformanceIndicatorId:null as number|null,deadline:"",output:"",notes:"",frequency:"Bulanan",generationDay:1,dueOffsetDays:7,startDate:new Date().toISOString().slice(0,10),endDate:"",verifierEmail:""});
const parsePics=(raw:any)=>{if(Array.isArray(raw))return raw as string[];try{return typeof raw==="string"?JSON.parse(raw) as string[]:[]}catch{return[]}};
const getPicNames=(t:Task,assigneesList:Assignee[]=[]):string[]=>{
 if(Array.isArray(t.picNames)&&t.picNames.length>0)return t.picNames;
 const emails=parsePics(t.picEmails);
 return emails.map(email=>{
  const found=assigneesList.find(a=>a.email?.toLowerCase()===email.toLowerCase());
  return found?.fullName?.trim()||email;
 });
};
const OUTPUT_CATEGORIES=[
 ["Dokumen","Surat, memo, berita acara, SOP, proposal"],
 ["Laporan","Laporan kegiatan, laporan keuangan, laporan progres"],
 ["Data","Database, rekap, daftar inventaris, data pegawai"],
 ["File spreadsheet","Excel perhitungan, anggaran, rekap transaksi"],
 ["Presentasi","PPT, bahan rapat, laporan visual"],
 ["Komunikasi","Email, pengumuman, surat dinas"],
 ["Arsip","Arsip fisik, folder digital, database dokumen"],
 ["Jadwal","Agenda rapat, timeline, jadwal kerja"],
 ["Hasil kegiatan","Rapat terlaksana, pengadaan selesai, kegiatan terdokumentasi"],
 ["Rekomendasi","Hasil analisis, evaluasi, usulan perbaikan"],
 ["Lain-lain","Kategori output pekerjaan lainnya yang belum tercakup di atas"],
] as const;

const KNOWN_OUTPUT_CATEGORIES = [
  "Dokumen",
  "Laporan",
  "Data",
  "File spreadsheet",
  "Presentasi",
  "Komunikasi",
  "Arsip",
  "Jadwal",
  "Hasil kegiatan",
  "Rekomendasi",
];
const KNOWN_OUTPUT_PATTERN = KNOWN_OUTPUT_CATEGORIES.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|");

function parseOutputCategories(raw?: string) {
  if (!raw) return { selected: ["Dokumen"], otherText: "" };

  let remaining = raw;
  let otherText = "";
  let hasOther = false;

  const parenRegex = new RegExp("(?:^|,\\s*)Lain-(?:lain|nya)\\s*\\(([\\s\\S]*?)\\)(?=(?:,\\s*(?:" + KNOWN_OUTPUT_PATTERN + "))|$)", "i");
  const parenMatch = remaining.match(parenRegex);

  if (parenMatch) {
    hasOther = true;
    otherText = parenMatch[1];
    const idx = parenMatch.index ?? 0;
    remaining = remaining.slice(0, idx) + "," + remaining.slice(idx + parenMatch[0].length);
  } else {
    const colonRegex = new RegExp("(?:^|,\\s*)Lain-(?:lain|nya):\\s*([\\s\\S]*?)(?=(?:,\\s*(?:" + KNOWN_OUTPUT_PATTERN + "))|$)", "i");
    const colonMatch = remaining.match(colonRegex);
    if (colonMatch) {
      hasOther = true;
      otherText = colonMatch[1];
      const idx = colonMatch.index ?? 0;
      remaining = remaining.slice(0, idx) + "," + remaining.slice(idx + colonMatch[0].length);
    } else {
      const bareRegex = new RegExp("(?:^|,\\s*)Lain-(?:lain|nya)(?=(?:,\\s*(?:" + KNOWN_OUTPUT_PATTERN + "))|$)", "i");
      const bareMatch = remaining.match(bareRegex);
      if (bareMatch) {
        hasOther = true;
        const idx = bareMatch.index ?? 0;
        remaining = remaining.slice(0, idx) + "," + remaining.slice(idx + bareMatch[0].length);
      }
    }
  }

  const parts = remaining.split(/,\s*/);
  const selected: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed && !selected.includes(trimmed)) {
      selected.push(trimmed);
    }
  }

  if (hasOther && !selected.includes("Lain-lain")) {
    selected.push("Lain-lain");
  }

  return { selected: selected.length ? selected : ["Dokumen"], otherText };
}

function serializeOutputCategories(selected: string[], otherText: string): string {
  if (!selected.length) return "Dokumen";
  const list = selected.map(cat => {
    if (cat === "Lain-lain") {
      return otherText ? `Lain-lain (${otherText})` : "Lain-lain";
    }
    return cat;
  });
  return list.join(", ");
}
type ScopeFilter = "aktif" | "semua" | "selesai" | "overdue";

function parseExtensionRequest(notes?: string) {
  if (!notes) return null;
  const matches = [...notes.matchAll(/\[Permohonan Perpanjangan Deadline s\.d ([^:]+):\s*([^\]]+)\]/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return {
    requestedDeadline: last[1].trim(),
    reason: last[2].trim(),
  };
}

function isExtensionPending(task: Task) {
  const req = parseExtensionRequest(task.notes);
  if (!req) return false;
  const lastReqIndex = (task.notes || "").lastIndexOf("[Permohonan Perpanjangan Deadline");
  const lastApproveIndex = (task.notes || "").lastIndexOf("[Perpanjangan Deadline Disetujui");
  return lastReqIndex > lastApproveIndex;
}

export default function RecurringTaskManager(){
  const [tasks,setTasks]=useState<Task[]>([]);
  const [templates,setTemplates]=useState<Template[]>([]);
  const [assignees,setAssignees]=useState<Assignee[]>([]);
  const [units,setUnits]=useState<OrgUnit[]>([]);
  const [performanceSources,setPerformanceSources]=useState<PerformanceSource[]>([]);
  const [form,setForm]=useState(fresh());
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState<Task|null>(null);
  const [reviewingTask,setReviewingTask]=useState<Task|null>(null);
  const [requestingExtensionTask,setRequestingExtensionTask]=useState<Task|null>(null);
  const [approvingExtensionTask,setApprovingExtensionTask]=useState<Task|null>(null);
  const [canManageRecurring,setCanManageRecurring]=useState(false);
  const [canCreate,setCanCreate]=useState(false);
  const [canAdmin,setCanAdmin]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [q,setQ]=useState("");
  const [scopeFilter,setScopeFilter]=useState<ScopeFilter>("aktif");
  const [status,setStatus]=useState("Semua");
  const [unitFilter,setUnitFilter]=useState("Semua");
  const [priorityFilter,setPriorityFilter]=useState("Semua");
  const [typeFilter,setTypeFilter]=useState("Semua");
  const [deadlineFilter,setDeadlineFilter]=useState("Semua");
  const [page,setPage]=useState(1);
  const [currentEmail,setCurrentEmail]=useState("");
  const [progressTask,setProgressTask]=useState<Task|null>(null);
  const [progressHistory,setProgressHistory]=useState<ProgressUpdate[]>([]);
  const [progressForm,setProgressForm]=useState({progress:0,outputRealization:"",completedActivities:"",obstacles:"",notes:""});
  const [canApproveTaskIds,setCanApproveTaskIds]=useState<number[]>([]);

  const load=()=>Promise.all([fetch("/api/recurring-tasks"),fetch("/api/task-assignees"),fetch("/api/monitoring"),fetch("/api/task-performance-sources")]).then(async([tr,ar,mr,pr])=>{
    const t=await tr.json(),a=await ar.json(),m=await mr.json(),p=await pr.json();
    if(tr.ok){setTemplates(t.templates||[]);setCanManageRecurring(Boolean(t.canManage))}
    if(ar.ok){setAssignees(a.assignees||[]);setUnits(a.units||[]);setCanCreate(Boolean(a.canCreate));setCanAdmin(Boolean(a.canAdministerTasks));setCurrentEmail(a.currentEmail||"")}
    if(mr.ok){setTasks(m.tasks||[]);setCanApproveTaskIds(m.canApproveTaskIds||[])}
    if(pr.ok)setPerformanceSources(p.sources||[])
  });

  useEffect(()=>{
    let active=true;
    Promise.all([fetch("/api/recurring-tasks"),fetch("/api/task-assignees"),fetch("/api/monitoring"),fetch("/api/task-performance-sources")]).then(async([tr,ar,mr,pr])=>{
      const t=await tr.json(),a=await ar.json(),m=await mr.json(),p=await pr.json();
      if(!active)return;
      if(tr.ok){setTemplates(t.templates||[]);setCanManageRecurring(Boolean(t.canManage))}
      if(ar.ok){setAssignees(a.assignees||[]);setUnits(a.units||[]);setCanCreate(Boolean(a.canCreate));setCanAdmin(Boolean(a.canAdministerTasks));setCurrentEmail(a.currentEmail||"")}
      if(mr.ok){setTasks(m.tasks||[]);setCanApproveTaskIds(m.canApproveTaskIds||[])}
      if(pr.ok)setPerformanceSources(p.sources||[])
    });
    return()=>{active=false}
  },[]);

  const today=new Date().toISOString().slice(0,10);
  const deadlineOf=(task:Task)=>{const d=task.extendedDeadline||task.deadline||"";return d==="Belum ditentukan"?"":d};

  const filtered=useMemo(()=>tasks.filter(t=>{
    const deadline=deadlineOf(t);
    const isCompleted=t.status==="Selesai"||t.progress>=100;
    const isOverdue=Boolean(deadline&&deadline<today&&!isCompleted);

    if (scopeFilter === "aktif" && isCompleted) return false;
    if (scopeFilter === "selesai" && !isCompleted) return false;
    if (scopeFilter === "overdue" && !isOverdue) return false;

    const picNames=getPicNames(t,assignees);
    const qLower=q.toLowerCase();
    const matchQuery=!q||t.title.toLowerCase().includes(qLower)||t.unit.toLowerCase().includes(qLower)||picNames.some(name=>name.toLowerCase().includes(qLower))||parsePics(t.picEmails).some(email=>email.toLowerCase().includes(qLower));

    return matchQuery&&
      (status==="Semua"||t.status===status)&&
      (unitFilter==="Semua"||t.unit.trim().toLowerCase()===unitFilter.trim().toLowerCase())&&
      (priorityFilter==="Semua"||t.priority===priorityFilter)&&
      (typeFilter==="Semua"||(typeFilter==="Berulang")===Boolean(t.recurringTemplateId))&&
      (deadlineFilter==="Semua"||(deadlineFilter==="Melewati deadline"&&isOverdue)||(deadlineFilter==="Belum melewati deadline"&&Boolean(deadline)&&!isOverdue)||(deadlineFilter==="Tanpa deadline"&&!deadline));
  }),[tasks,assignees,q,status,unitFilter,priorityFilter,typeFilter,deadlineFilter,scopeFilter,today]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>setPage(1),[q,status,unitFilter,priorityFilter,typeFilter,deadlineFilter,scopeFilter]);

  const pages=Math.max(1,Math.ceil(filtered.length/25));
  const rows=filtered.slice((page-1)*25,page*25);
  const active=tasks.filter(t=>t.status!=="Selesai"&&t.progress<100);
  const completed=tasks.filter(t=>t.status==="Selesai"||t.progress>=100);
  const overdue=active.filter(t=>Boolean(deadlineOf(t)&&deadlineOf(t)<today));
  const average=tasks.length?Math.round(tasks.reduce((s,t)=>s+t.progress,0)/tasks.length):0;

  const togglePic=(email:string)=>setForm({...form,picEmails:form.picEmails.includes(email)?form.picEmails.filter(x=>x!==email):[...form.picEmails,email]});

  const save=async()=>{
    setSaving(true);
    setMessage("");
    const recurring=form.mode==="Berulang",r=await fetch(recurring?"/api/recurring-tasks":"/api/tasks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)}),d=await r.json();
    setSaving(false);
    if(!r.ok){setMessage(d.error||"To-Do belum tersimpan");return}
    setForm(fresh());
    setShowForm(false);
    setMessage(recurring?"Template berulang berhasil diaktifkan.":"To-Do berhasil dibuat.");
    load();
  };

  const saveEdit=async()=>{
    if(!editing)return;
    setSaving(true);
    const r=await fetch(canAdmin?"/api/admin/tasks":"/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({...editing,action:canAdmin?undefined:"supervisor_edit",picEmails:parsePics(editing.picEmails)})}),d=await r.json();
    setSaving(false);
    if(!r.ok){setMessage(d.error||"Perubahan belum tersimpan");return}
    setEditing(null);
    setMessage("To-Do berhasil diperbarui.");
    load();
  };

  const handleApproveWithAdjustments=async(task:Task,adjustments:{picEmails:string[];deadline:string;priority:string;decisionNote:string})=>{
    setSaving(true);
    try{
      const r=await fetch("/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:task.id,action:"approve",picEmails:adjustments.picEmails,deadline:adjustments.deadline,priority:adjustments.priority,decisionNote:adjustments.decisionNote||"Disetujui oleh atasan langsung"})}),d=await r.json();
      setSaving(false);
      if(!r.ok){setMessage(d.error||"Gagal menyetujui To-Do");return}
      setReviewingTask(null);
      setMessage("To-Do berhasil disesuaikan dan disetujui. Tugas telah aktif untuk dikerjakan.");
      load();
    }catch(err:any){setSaving(false);setMessage(err?.message||"Gagal menyimpan keputusan.")}
  };

  const handleRequestExtension=async(task:Task,requestedDeadline:string,reason:string)=>{
    setSaving(true);
    try{
      const r=await fetch("/api/tasks",{
        method:"PATCH",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({id:task.id,action:"request_extension",requestedDeadline,reason})
      });
      const d=await r.json();
      setSaving(false);
      if(!r.ok){setMessage(d.error||"Gagal mengajukan perpanjangan deadline");return}
      setRequestingExtensionTask(null);
      setMessage(`Permohonan perpanjangan deadline s.d ${requestedDeadline} berhasil dikirim ke atasan.`);
      load();
    }catch(err:any){setSaving(false);setMessage(err?.message||"Gagal mengajukan perpanjangan.")}
  };

  const handleApproveExtension=async(task:Task,extendedDeadline:string,decisionNote:string)=>{
    setSaving(true);
    try{
      const r=await fetch("/api/tasks",{
        method:"PATCH",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({id:task.id,action:"approve_extension",extendedDeadline,decisionNote})
      });
      const d=await r.json();
      setSaving(false);
      if(!r.ok){setMessage(d.error||"Gagal menyetujui perpanjangan deadline");return}
      setApprovingExtensionTask(null);
      setMessage(`Perpanjangan deadline berhasil disetujui hingga ${extendedDeadline}.`);
      load();
    }catch(err:any){setSaving(false);setMessage(err?.message||"Gagal menyetujui perpanjangan.")}
  };

  const remove=async(task:Task)=>{
    const reason=prompt(`Alasan menghapus To-Do “${task.title}” (minimal 5 karakter):`);
    if(!reason||reason.trim().length<5){setMessage("Penghapusan dibatalkan. Alasan minimal 5 karakter.");return}
    const r=await fetch(`/api/admin/tasks?id=${task.id}&reason=${encodeURIComponent(reason.trim())}`,{method:"DELETE"});
    const d=await r.json();
    if(r.ok){setMessage("To-Do berhasil dihapus dan dicatat dalam audit.");load()}else setMessage(d.error||"To-Do belum dapat dihapus.");
  };

  const changeTemplate=async(t:Template,next:Template["status"])=>{
    await fetch("/api/recurring-tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:t.id,status:next})});
    load();
  };

  const canUpdate=(task:Task)=>Boolean(currentEmail&&parsePics(task.picEmails).map(x=>x.toLowerCase()).includes(currentEmail.toLowerCase()));
  const canEditUnstarted=(task:Task)=>task.createdBy.toLowerCase()===currentEmail.toLowerCase()&&task.status==="Baru"&&task.progress===0;
  const sourceFor=(task:Task)=>performanceSources.find(source=>source.indicatorId===task.sourcePerformanceIndicatorId);

  const openProgress=async(task:Task)=>{
    setMessage("");
    setProgressTask(task);
    setProgressForm({progress:task.progress,outputRealization:task.output||"",completedActivities:"",obstacles:"",notes:""});
    setProgressHistory([]);
    try{const r=await fetch(`/api/tasks?taskId=${task.id}`);if(r.ok){const d=await r.json();setProgressHistory(d.history||[])}}catch{}
  };

  const saveProgress=async()=>{
    if(!progressTask)return;
    if(!progressForm.completedActivities.trim()){setMessage("Kegiatan yang sudah dilaksanakan wajib diisi.");return}
    if(progressForm.progress===100&&!progressForm.outputRealization.trim()){setMessage("Realisasi output wajib diisi untuk progres 100%.");return}
    setSaving(true);
    try{
      const r=await fetch("/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:progressTask.id,...progressForm})}),d=await r.json();
      setSaving(false);
      if(!r.ok){setMessage(d.error||"Progress belum tersimpan.");return}
      setProgressTask(null);
      setMessage(progressForm.progress===100?"Progress 100% dikirim untuk verifikasi atasan.":"Progress berhasil diperbarui.");
      load();
    }catch(e:any){setSaving(false);setMessage(e?.message||"Progress belum tersimpan.")}
  };

  const taskApproval=async(task:Task,action:"request_approval"|"approve"|"reject"|"needs_revision"|"verify_complete"|"verify_revision")=>{
    const needsNote=["reject","needs_revision","verify_revision"].includes(action),decisionNote=needsNote?(prompt(action==="reject"?"Alasan penolakan:":"Catatan perbaikan:")||""):"";
    if(needsNote&&!decisionNote.trim())return;
    const r=await fetch("/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:task.id,action,decisionNote})}),d=await r.json();
    setMessage(r.ok?(action==="request_approval"?"To-Do telah diajukan kepada atasan.":action==="verify_complete"?"Pekerjaan telah diverifikasi dan dinyatakan selesai.":action==="verify_revision"?"Pekerjaan dikembalikan untuk perbaikan.":"Keputusan persetujuan berhasil disimpan."):(d.error||"Tindakan belum berhasil."));
    if(r.ok)load();
  };

  const hasActions=canAdmin||tasks.some(t=>canUpdate(t)||canApproveTaskIds.includes(t.id)||canEditUnstarted(t));

  return (
    <section className="todo-database-page">
      <div className="page-title">
        <div>
          <p>DATABASE PEKERJAAN</p>
          <h1>To-Do & Progres</h1>
          <span>Maksimal 25 baris per halaman · sesuai cakupan kewenangan.</span>
        </div>
        {canCreate&&(
          <button className="primary" onClick={()=>{
            setMessage("");
            const currentUser=assignees.find(a=>a.email?.toLowerCase()===currentEmail.toLowerCase());
            const isLeader=currentUser&&isLeadershipRole(currentUser.position);
            setForm({...fresh(),unit:currentUser?.unit||"",picEmails:(currentUser&&!isLeader)?[currentUser.email]:[]});
            setShowForm(true);
          }}>
            ＋ Buat To-Do
          </button>
        )}
      </div>

      {message&&<div className="todo-success">{message}</div>}

      {/* Kartu Ringkasan Interaktif: Klik untuk memfilter langsung */}
      <div className="todo-summary progress-report">
        <article
          className={`summary-card-btn ${scopeFilter === "semua" ? "active-filter-card" : ""}`}
          role="button"
          tabIndex={0}
          title="Klik untuk melihat seluruh To-Do (aktif & selesai)"
          onClick={() => { setScopeFilter("semua"); setStatus("Semua"); setDeadlineFilter("Semua"); }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { setScopeFilter("semua"); setStatus("Semua"); setDeadlineFilter("Semua"); } }}
        >
          <b>{tasks.length}</b>
          <span>Total pekerjaan</span>
          {scopeFilter === "semua" && <span className="active-pill">Aktif dipilih</span>}
        </article>

        <article
          className={`summary-card-btn ${scopeFilter === "aktif" ? "active-filter-card" : ""}`}
          role="button"
          tabIndex={0}
          title="Klik untuk melihat To-Do yang masih aktif (Default)"
          onClick={() => { setScopeFilter("aktif"); setStatus("Semua"); setDeadlineFilter("Semua"); }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { setScopeFilter("aktif"); setStatus("Semua"); setDeadlineFilter("Semua"); } }}
        >
          <b>{active.length}</b>
          <span>Masih aktif</span>
          {scopeFilter === "aktif" && <span className="active-pill">Aktif dipilih (Default)</span>}
        </article>

        <article
          className={`summary-card-btn ${scopeFilter === "selesai" ? "active-filter-card" : ""}`}
          role="button"
          tabIndex={0}
          title="Klik untuk melihat To-Do yang sudah selesai (100%)"
          onClick={() => { setScopeFilter("selesai"); setStatus("Semua"); setDeadlineFilter("Semua"); }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { setScopeFilter("selesai"); setStatus("Semua"); setDeadlineFilter("Semua"); } }}
        >
          <b>{completed.length}</b>
          <span>Selesai</span>
          {scopeFilter === "selesai" && <span className="active-pill">Aktif dipilih</span>}
        </article>

        <article className="summary-card-info">
          <b>{average}%</b>
          <span>Rata-rata progres</span>
        </article>

        <article
          className={`summary-card-btn ${overdue.length ? "warning " : ""} ${scopeFilter === "overdue" ? "active-filter-card" : ""}`}
          role="button"
          tabIndex={0}
          title="Klik untuk melihat To-Do yang melewati deadline"
          onClick={() => { setScopeFilter("overdue"); setStatus("Semua"); setDeadlineFilter("Melewati deadline"); }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { setScopeFilter("overdue"); setStatus("Semua"); setDeadlineFilter("Melewati deadline"); } }}
        >
          <b>{overdue.length}</b>
          <span>Melewati deadline · klik untuk melihat</span>
          {scopeFilter === "overdue" && <span className="active-pill">Aktif dipilih</span>}
        </article>
      </div>

      <div className="todo-toolbar advanced">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari pekerjaan, unit, atau nama PIC..."/>
        <select aria-label="Filter jenis To-Do" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
          {["Semua","Sekali","Berulang"].map(x=><option key={x}>{x}</option>)}
        </select>
        <select aria-label="Filter unit" value={unitFilter} onChange={e=>setUnitFilter(e.target.value)}>
          <option>Semua</option>
          {Array.from(new Set(tasks.map(t=>t.unit))).sort().map(x=><option key={x}>{x}</option>)}
        </select>
        <select aria-label="Filter prioritas" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>
          {["Semua","Rendah","Sedang","Tinggi","Urgent"].map(x=><option key={x}>{x}</option>)}
        </select>
        <select aria-label="Filter status" value={status} onChange={e=>{
          const nextStatus = e.target.value;
          setStatus(nextStatus);
          if (nextStatus === "Selesai") setScopeFilter("selesai");
          else if (nextStatus !== "Semua" && scopeFilter === "selesai") setScopeFilter("aktif");
        }}>
          {["Semua","Baru","Ditolak","Dikerjakan","Menunggu Verifikasi","Verifikasi Final","Perbaikan","Selesai"].map(x=><option key={x}>{x}</option>)}
        </select>
        <select aria-label="Filter deadline" value={deadlineFilter} onChange={e=>{
          const nextDl = e.target.value;
          setDeadlineFilter(nextDl);
          if (nextDl === "Melewati deadline") setScopeFilter("overdue");
          else if (scopeFilter === "overdue") setScopeFilter("aktif");
        }}>
          {["Semua","Melewati deadline","Belum melewati deadline","Tanpa deadline"].map(x=><option key={x}>{x}</option>)}
        </select>
      </div>

      <div className="employee-table-wrap">
        <table className="employee-table todo-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Uraian</th>
              <th>Jenis</th>
              <th>PIC</th>
              <th>Unit</th>
              <th>Prioritas</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Output</th>
              <th>Catatan</th>
              <th>Persetujuan/Verifikasi</th>
              {hasActions&&<th>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((t,i)=>{
                const pk=sourceFor(t),pkLabel=t.sourcePkLabel||(pk?`${pk.ownerPosition} · ${pk.indicator}`:"");
                const picNames=getPicNames(t,assignees);
                const deadline=deadlineOf(t);
                const isCompleted=t.status==="Selesai"||t.progress>=100;
                const isOverdue=Boolean(deadline&&deadline<today&&!isCompleted);
                const pendingExt=isExtensionPending(t)?parseExtensionRequest(t.notes):null;
                const isPicOrCreator=canUpdate(t)||(t.createdBy.toLowerCase()===currentEmail.toLowerCase());
                const isSupervisorOrAdmin=canApproveTaskIds.includes(t.id)||canAdmin;

                return (
                  <tr key={t.id}>
                    <td>{(page-1)*25+i+1}</td>
                    <td>
                      <b>{t.title}</b>
                      {pkLabel&&<small className="task-pk-source">PK: {pkLabel}</small>}
                    </td>
                    <td>
                      <span className="access-badge">{t.recurringTemplateId?"Berulang":"Sekali"}</span>
                    </td>
                    <td>
                      {picNames.length ? (
                        <div className="todo-pic-list">
                          {picNames.slice(0,4).map((name,idx)=><span key={idx} className="todo-pic-badge" title={name}>{name}</span>)}
                          {picNames.length>4&&<span className="todo-pic-badge more" title={picNames.slice(4).join(", ")}>+{picNames.length-4} lainnya</span>}
                        </div>
                      ) : (
                        <span style={{color:"#94a3b8"}}>—</span>
                      )}
                    </td>
                    <td>{t.unit}</td>
                    <td>{t.priority}</td>
                    <td className="deadline-col-cell">
                      {deadline ? (
                        <div className="deadline-col-box">
                          <span className={`deadline-date ${isOverdue ? "text-overdue" : ""}`}>
                            {deadline}
                          </span>
                          {t.extendedDeadline && (
                            <span className="deadline-extended-badge" title={`Deadline awal: ${t.deadline || "-"}`}>
                              Perpanjangan
                            </span>
                          )}
                          {isOverdue && (
                            <span className="deadline-overdue-tag">
                              ⚠️ Lewat Deadline
                            </span>
                          )}
                          {pendingExt && (
                            <span className="extension-pending-badge" title={`Permohonan s.d ${pendingExt.requestedDeadline}: ${pendingExt.reason}`}>
                              ⏳ Minta {pendingExt.requestedDeadline}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{color:"#94a3b8"}}>—</span>
                      )}
                    </td>
                    <td><span className="status-badge">{t.status}</span></td>
                    <td>
                      <div className="table-progress"><i style={{width:`${t.progress}%`}}/></div>
                      {t.progress}%
                    </td>
                    <td>{t.output||"—"}</td>
                    <td>{t.notes||"—"}</td>
                    <td className="approval-col-cell">
                      <div className="approval-col-box">
                        <span className={`appr-status-badge ${String(t.approvalStatus || "auto").toLowerCase().replace(/\s+/g, "-")}`}>
                          {t.approvalStatus || "Tidak Perlu Persetujuan"}
                        </span>
                        {t.verificationStatus && (
                          <span className={`verif-status-badge ${t.verificationStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                            {t.verificationStatus}
                          </span>
                        )}
                        {t.approvalNote && (
                          <small className="approval-note-text" title={t.approvalNote}>
                            💬 {t.approvalNote}
                          </small>
                        )}
                      </div>
                    </td>
                    {hasActions&&(
                      <td>
                        <div className="row-actions">
                          {canUpdate(t)&&t.approvalStatus==="Draft"&&(
                            <button onClick={()=>taskApproval(t,"request_approval")}>Minta Persetujuan</button>
                          )}
                          {canUpdate(t)&&!["Draft","Menunggu Persetujuan","Ditolak"].includes(t.approvalStatus)&&t.status!=="Selesai"&&t.status!=="Verifikasi Final"&&(
                            <button onClick={()=>{setMessage("");openProgress(t)}}>Update Progress</button>
                          )}
                          {/* Persetujuan To-Do Baru */}
                          {canApproveTaskIds.includes(t.id)&&t.approvalStatus==="Menunggu Persetujuan"&&(
                            <>
                              <button className="primary" onClick={()=>taskApproval(t,"approve")} title="Setujui langsung jika rincian sudah sesuai">Setujui Langsung</button>
                              <button className="accent" onClick={()=>{setMessage("");setReviewingTask({...t})}} title="Sesuaikan staf PIC & deadline lalu setujui">Sesuaikan & Setujui</button>
                              <button className="danger" onClick={()=>taskApproval(t,"reject")}>Tolak</button>
                            </>
                          )}
                          {/* Keputusan Perpanjangan Deadline untuk Kasubag / Supervisor */}
                          {isSupervisorOrAdmin&&pendingExt&&t.status!=="Selesai"&&(
                            <button className="accent" onClick={()=>{setMessage("");setApprovingExtensionTask({...t})}} title="Periksa dan setujui permohonan perpanjangan deadline staf">
                              Setujui Perpanjangan
                            </button>
                          )}
                          {/* Tombol Minta Perpanjangan untuk Staf PIC / Pembuat Tugas */}
                          {isPicOrCreator&&!pendingExt&&!isCompleted&&t.status!=="Verifikasi Final"&&(
                            <button className="btn-request-ext" onClick={()=>{setMessage("");setRequestingExtensionTask({...t})}} title="Ajukan perpanjangan tenggat waktu (deadline)">
                              Minta Perpanjangan
                            </button>
                          )}
                          {/* Verifikasi Akhir */}
                          {canApproveTaskIds.includes(t.id)&&t.status==="Verifikasi Final"&&(
                            <>
                              <button onClick={()=>taskApproval(t,"verify_complete")}>Verifikasi Selesai</button>
                              <button onClick={()=>taskApproval(t,"verify_revision")}>Minta Perbaikan</button>
                            </>
                          )}
                          {/* Sesuaikan To-Do */}
                          {(canAdmin||canApproveTaskIds.includes(t.id)||canEditUnstarted(t))&&t.status!=="Selesai"&&t.status!=="Verifikasi Final"&&t.approvalStatus!=="Menunggu Persetujuan"&&(
                            <button onClick={()=>{setMessage("");setEditing({...t})}}>
                              {canAdmin||canApproveTaskIds.includes(t.id)?"Sesuaikan To-Do":"Edit sebelum dikerjakan"}
                            </button>
                          )}
                          {canAdmin&&<button className="danger" onClick={()=>remove(t)}>Hapus</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={hasActions?13:12} className="empty-state">
                  Belum ada To-Do yang sesuai dengan filter ({scopeFilter === "aktif" ? "Hanya menampilkan To-Do aktif" : scopeFilter === "selesai" ? "Hanya menampilkan To-Do selesai" : scopeFilter === "overdue" ? "Hanya menampilkan To-Do lewat deadline" : "Seluruh To-Do"}).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>Menampilkan {filtered.length?((page-1)*25+1):0}–{Math.min(page*25,filtered.length)} dari {filtered.length}</span>
        <div>
          <button disabled={page<=1} onClick={()=>setPage(page-1)}>Sebelumnya</button>
          <b>{page} / {pages}</b>
          <button disabled={page>=pages} onClick={()=>setPage(page+1)}>Berikutnya</button>
        </div>
      </div>

      {templates.length>0&&(
        <section className="template-manager">
          <div>
            <b>Template To-Do Berulang</b>
            <span>{templates.length} template</span>
          </div>
          <div className="template-list compact">
            {templates.map(t=>(
              <article key={t.id}>
                <div>
                  <b>{t.title}</b>
                  <span>{t.unit} · {t.frequency} · hari ke-{t.generationDay}</span>
                </div>
                <em className={t.status.toLowerCase()}>{t.status}</em>
                {canManageRecurring&&(
                  <select value={t.status} onChange={e=>changeTemplate(t,e.target.value as Template["status"])}>
                    <option>Aktif</option>
                    <option>Dijeda</option>
                    <option>Nonaktif</option>
                  </select>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {showForm&&<CreateModal form={form} setForm={setForm} units={units} assignees={assignees} performanceSources={performanceSources} canRecurring={canManageRecurring} togglePic={togglePic} close={()=>setShowForm(false)} save={save} saving={saving} message={message}/>}
      {editing&&<EditModal task={editing} setTask={setEditing} units={units} assignees={assignees} performanceSources={performanceSources} close={()=>setEditing(null)} save={saveEdit} saving={saving} message={message}/>}
      {reviewingTask&&<ReviewModal task={reviewingTask} assignees={assignees} units={units} close={()=>{setReviewingTask(null);setMessage("")}} onApproveWithAdjustments={handleApproveWithAdjustments} saving={saving} message={message}/>}
      {progressTask&&<ProgressModal task={progressTask} form={progressForm} setForm={setProgressForm} history={progressHistory} assignees={assignees} close={()=>{setProgressTask(null);setMessage("")}} save={saveProgress} saving={saving} message={message}/>}
      {requestingExtensionTask&&(
        <RequestExtensionModal
          task={requestingExtensionTask}
          close={()=>{setRequestingExtensionTask(null);setMessage("")}}
          onRequest={handleRequestExtension}
          saving={saving}
          message={message}
        />
      )}
      {approvingExtensionTask&&(
        <ApproveExtensionModal
          task={approvingExtensionTask}
          close={()=>{setApprovingExtensionTask(null);setMessage("")}}
          onApprove={handleApproveExtension}
          saving={saving}
          message={message}
        />
      )}
    </section>
  );
}
function ProgressModal({task,form,setForm,history,assignees=[],close,save,saving,message}:any){const formatTime=(raw:string)=>{if(!raw)return"-";const clean=raw.includes("T")?raw:raw.replace(" ","T"),parsed=new Date(clean);return isNaN(parsed.getTime())?raw:parsed.toLocaleString("id-ID")};return <div className="modal-backdrop" onMouseDown={close}><div className="modal progress-update-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}><span>UPDATE PROGRESS TO-DO</span><Title title={task.title} close={close}/><p>Progress 100% akan berstatus Verifikasi Final sampai diperiksa atasan.</p><div className="module-form two-col"><label>Progress (%)<input type="number" min="0" max="100" value={isNaN(form.progress)?"":form.progress} onChange={e=>{const val=e.target.value;setForm({...form,progress:val===""?0:Math.max(0,Math.min(100,Number(val)))})}}/></label><label>Status sistem<input value={form.progress===100?"Verifikasi Final":"Dikerjakan"} disabled/></label><label className="wide">Kegiatan yang sudah dilaksanakan<textarea rows={3} value={form.completedActivities} onChange={e=>setForm({...form,completedActivities:e.target.value})}/></label><label className="wide">Realisasi output<textarea rows={3} value={form.outputRealization} onChange={e=>setForm({...form,outputRealization:e.target.value})}/></label><label className="wide">Kendala<textarea rows={2} value={form.obstacles} onChange={e=>setForm({...form,obstacles:e.target.value})}/></label><label className="wide">Catatan tambahan<textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div>{history.length>0&&<div className="progress-history"><h4>Riwayat Pembaruan</h4>{history.slice(0,5).map((row:ProgressUpdate)=>{const emp=assignees.find((a:Assignee)=>a.email?.toLowerCase()===row.employeeEmail.toLowerCase());return <article key={row.id}><b>{row.progress}%</b><div><strong>{row.completedActivities}</strong><small>{emp?.fullName||row.employeeEmail} · {formatTime(row.createdAt)}</small>{row.obstacles&&<small>Kendala: {row.obstacles}</small>}</div></article>})}</div>}<Actions close={close} save={save} saving={saving} label="Simpan Progress" message={message}/></div></div>}
function CreateModal({form,setForm,units,assignees,performanceSources,canRecurring,togglePic,close,save,saving,message}:any){return <div className="modal-backdrop" onMouseDown={close}><div className="modal todo-form-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}><span>FORM TO-DO</span><Title title="Buat pekerjaan baru" close={close}/><div className="task-mode"><button className={form.mode==="Sekali"?"active":""} onClick={()=>setForm({...form,mode:"Sekali"})}><b>Sekali</b><small>Dibuat satu kali</small></button>{canRecurring&&<button className={form.mode==="Berulang"?"active":""} onClick={()=>setForm({...form,mode:"Berulang"})}><b>Berulang</b><small>Otomatis per periode</small></button>}</div><div className="module-form two-col"><BaseFields value={form} setValue={setForm} units={units}/>{form.mode==="Sekali"?<label>Deadline<input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></label>:<><label>Frekuensi<select value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value})}>{["Mingguan","Bulanan","Triwulan","Semester"].map(x=><option key={x}>{x}</option>)}</select></label><label>Hari ke-<input type="number" min="1" max="28" value={form.generationDay} onChange={e=>setForm({...form,generationDay:Number(e.target.value)})}/></label><label>Tenggat +hari<input type="number" min="0" value={form.dueOffsetDays} onChange={e=>setForm({...form,dueOffsetDays:Number(e.target.value)})}/></label><label>Mulai<input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></label><label>Selesai opsional<input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label></>}<PerformanceSourcePicker value={form.sourcePerformanceIndicatorId} sources={performanceSources} unit={form.unit} change={(source:PerformanceSource|null)=>setForm({...form,sourcePerformanceAgreementId:source?.agreementId||null,sourcePerformanceIndicatorId:source?.indicatorId||null})}/><OutputCategoryPicker value={form.outputType} change={(outputType:string)=>setForm({...form,outputType})}/>{form.mode==="Sekali"&&<label className="wide">Output yang diharapkan<input value={form.output} onChange={e=>setForm({...form,output:e.target.value})}/></label>}<label className="wide">Catatan<textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><PicPicker emails={form.picEmails} assignees={assignees} unit={form.unit} toggle={togglePic}/></div><Actions close={close} save={save} saving={saving} label={form.mode==="Sekali"?"Buat To-Do":"Aktifkan Berulang"} message={message}/></div></div>}
function EditModal({task,setTask,units,assignees,performanceSources,close,save,saving,message}:any){const emails=parsePics(task.picEmails),toggle=(email:string)=>setTask({...task,picEmails:JSON.stringify(emails.includes(email)?emails.filter((x:string)=>x!==email):[...emails,email])});return <div className="modal-backdrop" onMouseDown={close}><div className="modal todo-form-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}><span>SUPER ADMIN / ATASAN · EDIT TO-DO</span><Title title="Perbaiki data pekerjaan" close={close}/><div className="module-form two-col"><BaseFields value={task} setValue={setTask} units={units}/><label>Deadline<input type="date" value={task.deadline||""} onChange={e=>setTask({...task,deadline:e.target.value})}/></label><label>Perpanjangan deadline<input type="date" value={task.extendedDeadline||""} onChange={e=>setTask({...task,extendedDeadline:e.target.value})}/></label><label>Status<select value={task.status} onChange={e=>setTask({...task,status:e.target.value})}>{["Baru","Ditolak","Dikerjakan","Menunggu Verifikasi","Verifikasi Final","Perbaikan","Selesai"].map(x=><option key={x}>{x}</option>)}</select></label><label>Progress (%)<input type="number" min="0" max="100" value={task.progress} onChange={e=>setTask({...task,progress:Number(e.target.value)})}/></label><label>Verifikasi<select value={task.verificationStatus} onChange={e=>setTask({...task,verificationStatus:e.target.value})}><option>Belum Diverifikasi</option><option>Menunggu Verifikasi</option><option>Terverifikasi</option><option>Perlu Perbaikan</option></select></label><PerformanceSourcePicker value={task.sourcePerformanceIndicatorId} sources={performanceSources} unit={task.unit} change={(source:PerformanceSource|null)=>setTask({...task,sourcePerformanceAgreementId:source?.agreementId||null,sourcePerformanceIndicatorId:source?.indicatorId||null})}/><OutputCategoryPicker value={task.outputType||"Dokumen"} change={(outputType:string)=>setTask({...task,outputType})}/><label className="wide">Output<input value={task.output||""} onChange={e=>setTask({...task,output:e.target.value})}/></label><label className="wide">Catatan<textarea rows={3} value={task.notes||""} onChange={e=>setTask({...task,notes:e.target.value})}/></label><PicPicker emails={emails} assignees={assignees} unit={task.unit} toggle={toggle}/></div><Actions close={close} save={save} saving={saving} label="Simpan Perubahan" message={message}/></div></div>}
function BaseFields({value,setValue,units}:any){return <><label>Uraian<input value={value.title} onChange={e=>setValue({...value,title:e.target.value})}/></label><label>Unit/Subbagian<select value={value.unit} onChange={e=>setValue({...value,unit:e.target.value})}><option value="">Pilih Struktur Organisasi</option>{units.map((u:OrgUnit)=><option key={u.id} value={u.name}>{u.name} · {u.type}</option>)}</select></label><label>Prioritas<select value={value.priority} onChange={e=>setValue({...value,priority:e.target.value})}>{["Rendah","Sedang","Tinggi","Urgent"].map(x=><option key={x}>{x}</option>)}</select></label></>}
function isLeadershipRole(pos?: string | null): boolean {
  if (!pos) return false;
  const p = pos.trim().toLowerCase();
  return (
    p === "ketua" ||
    p === "anggota" ||
    p.includes("komisioner") ||
    p === "sekretaris" ||
    p.includes("kasubag") ||
    p.includes("kasubbag") ||
    p.includes("kepala sub") ||
    p.includes("kasub")
  );
}

function PicPicker({emails = [], assignees = [], unit = "", toggle}: any) {
  // Hanya staf pelaksana operasional yang menjadi opsi checklist PIC
  const staffOnly = assignees.filter((p: Assignee) => !isLeadershipRole(p.position));

  // Jika ada unit/subbagian, prioritaskan atau tampilkan staf pada unit tersebut
  const unitNormalized = unit.trim().toLowerCase();
  const unitFiltered = unitNormalized
    ? staffOnly.filter((p: Assignee) => (p.unit || "").trim().toLowerCase() === unitNormalized)
    : staffOnly;

  // Pastikan staf yang sedang tercentang tetap tampil di daftar agar tidak hilang
  const displayAssignees = unitFiltered.length > 0
    ? Array.from(new Set([...unitFiltered, ...staffOnly.filter((p: Assignee) => emails.includes(p.email))]))
    : staffOnly;

  // Deteksi nama PIC lama/legacy yang terdaftar sebagai Kasubag atau Pimpinan
  const legacyLeadershipPics = emails.filter((email: string) => {
    const found = assignees.find((a: Assignee) => a.email.toLowerCase() === email.toLowerCase());
    return found && isLeadershipRole(found.position);
  });

  return (
    <fieldset className="pic-picker wide">
      <legend>PIC / Staf Pelaksana ({emails.length} dipilih)</legend>
      <div className="pic-picker-helper">
        <small>
          {unit
            ? `Menampilkan staf di bawah garis koordinasi: ${unit}`
            : "Hanya staf pelaksana yang dapat dipilih sebagai penanggung jawab teknis."}
        </small>
      </div>

      {legacyLeadershipPics.length > 0 && (
        <div className="legacy-pic-alert">
          <span className="legacy-alert-title">⚠️ Terdapat Kasubag/Pimpinan yang tercatat di daftar PIC sebelumnya:</span>
          <div className="legacy-pic-chips">
            {legacyLeadershipPics.map((email: string) => {
              const p = assignees.find((a: Assignee) => a.email.toLowerCase() === email.toLowerCase());
              return (
                <span key={email} className="legacy-pic-badge">
                  <b>{p?.fullName || email}</b> ({p?.position || "Pimpinan"})
                  <button type="button" onClick={() => toggle(email)} title="Lepas Kasubag/Pimpinan dari PIC">
                    ✕ Lepas
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div>
        {displayAssignees.length > 0 ? (
          displayAssignees.map((p: Assignee) => {
            const isChecked = emails.includes(p.email);
            return (
              <label key={p.id} className={isChecked ? "selected" : ""}>
                <input type="checkbox" checked={isChecked} onChange={() => toggle(p.email)} />
                <span>
                  <b>{p.fullName}{p.isSelf ? " (Saya)" : ""}</b>
                  <small>{p.position || "Staf Pelaksana"} · {p.unit}</small>
                </span>
              </label>
            );
          })
        ) : (
          <p className="empty-subtext" style={{ padding: "0.5rem", color: "#64748b" }}>
            Tidak ada staf pelaksana yang ditemukan pada unit ini.
          </p>
        )}
      </div>
    </fieldset>
  );
}

function PerformanceSourcePicker({value,sources,unit,change}:any){
 const [open,setOpen]=useState(false),[search,setSearch]=useState("");
 const [onlyUnit,setOnlyUnit]=useState(true);
 const containerRef=useRef<HTMLDivElement>(null);
 const selected=sources.find((s:PerformanceSource)=>s.indicatorId===value);

 useEffect(()=>{
  const handleOutside=(e:MouseEvent)=>{if(containerRef.current&&!containerRef.current.contains(e.target as Node)){setOpen(false)}};
  if(open)document.addEventListener("mousedown",handleOutside);
  return()=>document.removeEventListener("mousedown",handleOutside);
 },[open]);

 const matchUnit = (s: PerformanceSource) => {
   if (!unit) return true;
   const u = unit.toLowerCase();
   const su = (s.unit || "").toLowerCase();
   const sp = (s.ownerPosition || "").toLowerCase();
   return su.includes(u) || sp.includes(u) ||
     (u.includes("rendatin") && (sp.includes("perencanaan") || su.includes("perencanaan"))) ||
     (u.includes("keuangan") && (sp.includes("keuangan") || su.includes("keuangan") || sp.includes("logistik"))) ||
     (u.includes("hukum") && (sp.includes("hukum") || su.includes("hukum") || sp.includes("sdm"))) ||
     (u.includes("teknis") && (sp.includes("teknis") || su.includes("teknis") || sp.includes("partisipasi")));
 };

 const availableForUnit = sources.filter(matchUnit);
 const baseSources = (onlyUnit && unit && availableForUnit.length > 0) ? availableForUnit : sources;

 const filtered=baseSources.filter((s:PerformanceSource)=>{
  if(!search.trim())return true;
  const q=search.toLowerCase();
  return s.indicator.toLowerCase().includes(q)||s.objective.toLowerCase().includes(q)||s.ownerPosition.toLowerCase().includes(q)||s.ownerName.toLowerCase().includes(q)||String(s.year).includes(q)||(s.target&&s.target.toLowerCase().includes(q));
 });

 return (
  <div className="wide pk-source-field" ref={containerRef}>
   <span className="pk-field-label">Sumber Perjanjian Kinerja (PK)</span>
   <div className="pk-searchable-field">
    <div className={`pk-searchable-trigger ${selected?"has-value":""}`} role="button" tabIndex={0} onClick={()=>setOpen(!open)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setOpen(!open)}}}>
     <div className="pk-trigger-content">
      {selected?(
       <>
        <span className="pk-trigger-badge">PK {selected.year} · {selected.ownerPosition}</span>
        <span className="pk-trigger-indicator">{selected.indicator}</span>
        <small className="pk-trigger-sub">Sasaran: {selected.objective} {selected.target?`(Target: ${selected.target})`:""}</small>
       </>
      ):(
       <span className="pk-trigger-placeholder">Pilih Sumber PK (atau Tidak terhubung)...</span>
      )}
     </div>
     <div className="pk-trigger-actions">
      {selected&&<button type="button" className="pk-clear-btn" title="Batalkan hubungan PK" onClick={e=>{e.stopPropagation();change(null)}}>✕ Lepas</button>}
      <span className="pk-chevron">{open?"▲":"▼"}</span>
     </div>
    </div>
    {open&&(
     <div className="pk-dropdown-panel" onMouseDown={e=>e.stopPropagation()}>
      {unit && availableForUnit.length > 0 && (
       <div className="pk-filter-tabs">
        <button
         type="button"
         className={onlyUnit ? "active" : ""}
         onClick={() => setOnlyUnit(true)}
        >
         🎯 Sesuai Subbagian ({availableForUnit.length})
        </button>
        <button
         type="button"
         className={!onlyUnit ? "active" : ""}
         onClick={() => setOnlyUnit(false)}
        >
         🌐 Seluruh Lembaga ({sources.length})
        </button>
       </div>
      )}
      <div className="pk-search-input-wrap">
       <input type="text" className="pk-search-input" autoFocus placeholder="🔍 Ketik untuk mencari sasaran, indikator, posisi, atau tahun PK..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="pk-options-list">
       <div className={`pk-option-none ${!value?"selected":""}`} onClick={()=>{change(null);setOpen(false);setSearch("")}}>
        ✕ Tidak terhubung dengan PK
       </div>
       {filtered.map((s:PerformanceSource)=>{
        const isItemActive=s.indicatorId===value;
        return (
         <div key={s.indicatorId} className={`pk-option-item ${isItemActive?"selected":""}`} onClick={()=>{change(s);setOpen(false);setSearch("")}}>
          <div className="pk-option-top">
           <span>Tahun {s.year} · {s.ownerPosition}</span>
           {s.target&&<span>Target: {s.target}</span>}
          </div>
          <div className="pk-option-title">{s.indicator}</div>
          <div className="pk-option-detail">Sasaran: {s.objective}</div>
         </div>
        );
       })}
       {filtered.length===0&&<div className="pk-option-empty">Tidak ditemukan indikator PK yang cocok dengan "{search}".</div>}
      </div>
     </div>
    )}
   </div>
   <small className="pk-field-hint">
    {unit ? `Menampilkan indikator PK relevan untuk ${unit}.` : "Hanya PK yang berada pada jalur koordinasi Anda yang tersedia."}
   </small>
  </div>
 );
}

function ReviewModal({task,assignees=[],units=[],close,onApproveWithAdjustments,saving,message}:any){
 const [pics,setPics]=useState<string[]>(parsePics(task.picEmails));
 const [deadline,setDeadline]=useState<string>(task.deadline||"");
 const [priority,setPriority]=useState<string>(task.priority||"Sedang");
 const [decisionNote,setDecisionNote]=useState<string>("");

 const togglePic=(email:string)=>{
  setPics(prev=>prev.includes(email)?prev.filter(x=>x!==email):[...prev,email]);
 };

 const addDays=(days:number)=>{
  const base=deadline?new Date(deadline):new Date();
  const d=new Date(base.getTime() + days * 86400000);
  setDeadline(d.toISOString().slice(0,10));
 };

 const creator=assignees.find((a:Assignee)=>a.email?.toLowerCase()===task.createdBy.toLowerCase());

 const handleApprove=()=>{
  if(pics.length===0){
   alert("Harap pilih minimal 1 staf pelaksana (PIC).");
   return;
  }
  onApproveWithAdjustments(task,{picEmails:pics,deadline,priority,decisionNote});
 };

 return (
  <div className="modal-backdrop" onMouseDown={close}>
   <div className="modal todo-review-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}>
    <span>SUPERVISI & PENYESUAIAN ATASAN</span>
    <Title title={`Sesuaikan & Setujui: “${task.title}”`} close={close}/>

    <div className="review-task-summary">
     <div className="summary-col">
      <small>Pengaju / Pembuat</small>
      <b>{creator?.fullName||task.createdBy}</b>
      <span>{creator?.position||"Staf"} · {task.unit}</span>
     </div>
     <div className="summary-col">
      <small>Output yang Diharapkan</small>
      <b>{task.output||"Tidak ada rincian output"}</b>
      <span>Bentuk: {task.outputType||"Dokumen"}</span>
     </div>
     <div className="summary-col">
      <small>Status Pengajuan</small>
      <span className="review-status-pill">{task.approvalStatus||"Menunggu Persetujuan"}</span>
     </div>
    </div>

    <div className="review-adjustments-body">
     <p className="review-guide-hint">
      💡 <b>Fleksibilitas Kasubag:</b> Anda dapat menambah/mengurangi staf pelaksana (misal menambah staf lain karena beban kerja), menyesuaikan tenggat waktu (deadline), dan memberikan catatan arahan sebelum menyetujui tugas. Setelah selesai, klik <b>Simpan & Setujui</b> agar tugas langsung aktif dikerjakan tanpa bolak-balik.
     </p>

     {/* 1. Tambah / Kurang PIC */}
     <PicPicker emails={pics} assignees={assignees} unit={task.unit} toggle={togglePic}/>

     {/* 2. Sesuaikan Deadline & Prioritas */}
     <div className="review-deadline-box">
      <div className="deadline-input-group">
       <label>
        Tenggat Waktu / Deadline yang Disetujui
        <input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/>
       </label>
       <div className="quick-deadline-btns">
        <span>Perpanjang:</span>
        <button type="button" onClick={()=>addDays(3)}>+3 Hari</button>
        <button type="button" onClick={()=>addDays(7)}>+1 Minggu</button>
        <button type="button" onClick={()=>addDays(14)}>+2 Minggu</button>
        <button type="button" onClick={()=>addDays(30)}>+1 Bulan</button>
       </div>
      </div>
      <label>
       Tingkat Prioritas
       <select value={priority} onChange={e=>setPriority(e.target.value)}>
        {["Rendah","Sedang","Tinggi","Urgent"].map(x=><option key={x}>{x}</option>)}
       </select>
      </label>
     </div>

     {/* 3. Catatan Arahan Kasubag */}
     <label className="wide review-note-label">
      Catatan Arahan Kasubag (Opsional)
      <textarea
       rows={2}
       placeholder="Contoh: Ditambahkan Mas Andre untuk pembagian beban kerja, deadline disesuaikan 7 hari ke depan."
       value={decisionNote}
       onChange={e=>setDecisionNote(e.target.value)}
      />
     </label>
    </div>

    {message&&<p className="form-message">{message}</p>}

    <div className="modal-actions">
     <button type="button" onClick={close}>Batal</button>
     <button
      type="button"
      className="primary"
      onClick={handleApprove}
      disabled={saving}
     >
      {saving?"Menyimpan...":"✓ Simpan & Setujui"}
     </button>
    </div>
   </div>
  </div>
 );
}
function OutputCategoryPicker({value,change}:any){
 const {selected,otherText:parsedOtherText}=parseOutputCategories(value);
 const [otherText,setOtherText]=useState(parsedOtherText);
 const lastSerializedRef=useRef<string>(value);

 useEffect(()=>{
  if(value!==lastSerializedRef.current){
   lastSerializedRef.current=value;
   setOtherText(parseOutputCategories(value).otherText);
  }
 },[value]);

 const toggleCategory=(cat:string)=>{
  let next:string[];
  if(selected.includes(cat)){
   next=selected.filter(x=>x!==cat);
   if(!next.length)next=["Dokumen"];
  }else{
   next=[...selected,cat];
  }
  const serialized=serializeOutputCategories(next,otherText);
  lastSerializedRef.current=serialized;
  change(serialized);
 };

 const updateOtherText=(text:string)=>{
  setOtherText(text);
  const serialized=serializeOutputCategories(selected,text);
  lastSerializedRef.current=serialized;
  change(serialized);
 };

 const handleBlur=()=>{
  const trimmed=otherText.trim();
  if(trimmed!==otherText){
   setOtherText(trimmed);
   const serialized=serializeOutputCategories(selected,trimmed);
   lastSerializedRef.current=serialized;
   change(serialized);
  }
 };

 return (
  <fieldset className="output-category-picker wide">
   <legend>Kategori Pekerjaan (Bisa pilih lebih dari satu)</legend>
   <p>Pilih satu atau lebih kategori berdasarkan bentuk output yang akan dihasilkan.</p>
   <div>
    {OUTPUT_CATEGORIES.map(([name,example])=>{
     const isSelected=selected.includes(name);
     return (
      <label key={name} className={isSelected?"selected":""}>
       <input type="checkbox" name="output-category" checked={isSelected} onChange={()=>toggleCategory(name)}/>
       <span>
        <b>{name}</b>
        <small>{example}</small>
       </span>
      </label>
     );
    })}
   </div>
   {selected.includes("Lain-lain")&&(
    <div className="output-other-input-wrap">
     <label>
      Keterangan Kategori Pekerjaan Lainnya
      <input
       type="text"
       placeholder="Contoh: Aplikasi web, publikasi media, spanduk, dll."
       value={otherText}
       onChange={e=>updateOtherText(e.target.value)}
       onBlur={handleBlur}
      />
     </label>
    </div>
   )}
  </fieldset>
 );
}
function Title({title,close}:any){return <div className="modal-title-row"><div><h3>{title}</h3><p>Perubahan disimpan ke database To-Do.</p></div><button aria-label="Tutup" onClick={close}>×</button></div>}
function Actions({close,save,saving,label,message}:any){return <>{message&&<p className="form-message">{message}</p>}<div className="modal-actions"><button onClick={close}>Batal</button><button className="primary" onClick={save} disabled={saving}>{saving?"Menyimpan...":label}</button></div></>}

function RequestExtensionModal({ task, close, onRequest, saving, message }: any) {
  const currentDl = task.extendedDeadline || task.deadline || "";
  const [requestedDate, setRequestedDate] = useState<string>(() => {
    const base = currentDl ? new Date(currentDl) : new Date();
    const d = new Date(base.getTime() + 7 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState<string>("");

  const addDays = (days: number) => {
    const base = currentDl ? new Date(currentDl) : new Date();
    const d = new Date(base.getTime() + days * 86400000);
    setRequestedDate(d.toISOString().slice(0, 10));
  };

  const handleSubmit = () => {
    if (!requestedDate) {
      alert("Tentukan tanggal perpanjangan deadline yang dimohonkan.");
      return;
    }
    if (!reason.trim()) {
      alert("Wajib menyertakan alasan permohonan perpanjangan waktu.");
      return;
    }
    onRequest(task, requestedDate, reason.trim());
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal extension-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <span>PERMOHONAN PERPANJANGAN WAKTU</span>
        <Title title={`Minta Perpanjangan: “${task.title}”`} close={close} />

        <div className="extension-target-box">
          <div className="ext-box-row"><small>Tenggat Waktu Saat Ini:</small> <b>{currentDl || "Belum ditentukan"}</b></div>
          <div className="ext-box-row"><small>Unit Kerja:</small> <span>{task.unit}</span></div>
          <div className="ext-box-row"><small>Status Pekerjaan:</small> <span>{task.status} ({task.progress}%)</span></div>
        </div>

        <div className="module-form">
          <div className="deadline-input-group">
            <label>
              Usulan Tanggal Deadline Baru
              <input type="date" value={requestedDate} onChange={e => setRequestedDate(e.target.value)} />
            </label>
            <div className="quick-days-btn-row">
              <span>Pilihan cepat:</span>
              <button type="button" onClick={() => addDays(3)}>+3 Hari</button>
              <button type="button" onClick={() => addDays(7)}>+1 Minggu</button>
              <button type="button" onClick={() => addDays(14)}>+2 Minggu</button>
              <button type="button" onClick={() => addDays(30)}>+1 Bulan</button>
            </div>
          </div>

          <label className="wide">
            Alasan Permohonan Perpanjangan Waktu <span style={{ color: "#ef4444" }}>*</span>
            <textarea
              rows={3}
              placeholder="Jelaskan alasan keterlambatan atau kebutuhan tambahan waktu (contoh: Menunggu kelengkapan data monev dari unit lain, beban kerja koordinasi mendesak, dsb.)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </label>
        </div>

        {message && <p className="form-message">{message}</p>}

        <div className="modal-actions">
          <button type="button" onClick={close}>Batal</button>
          <button type="button" className="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Mengirim..." : "Kirim Permohonan Perpanjangan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveExtensionModal({ task, close, onApprove, saving, message }: any) {
  const pending = parseExtensionRequest(task.notes);
  const initialDate = pending?.requestedDeadline || task.extendedDeadline || task.deadline || "";
  const [extendedDate, setExtendedDate] = useState<string>(initialDate);
  const [decisionNote, setDecisionNote] = useState<string>("");

  const addDays = (days: number) => {
    const base = initialDate ? new Date(initialDate) : new Date();
    const d = new Date(base.getTime() + days * 86400000);
    setExtendedDate(d.toISOString().slice(0, 10));
  };

  const handleSubmit = () => {
    if (!extendedDate) {
      alert("Tentukan tanggal perpanjangan deadline.");
      return;
    }
    onApprove(task, extendedDate, decisionNote.trim());
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal extension-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <span>PERSETUJUAN PERPANJANGAN DEADLINE</span>
        <Title title={`Keputusan Perpanjangan: “${task.title}”`} close={close} />

        {pending ? (
          <div className="extension-alert-box">
            <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <span>📋</span> Permohonan Perpanjangan dari Staf PIC:
            </div>
            <div><b>Deadline yang Diajukan:</b> {pending.requestedDeadline}</div>
            <div style={{ marginTop: 4 }}><b>Alasan Staf:</b> <em>“{pending.reason}”</em></div>
          </div>
        ) : (
          <div className="extension-target-box">
            <div><small>Deadline Saat Ini:</small> <b>{task.extendedDeadline || task.deadline || "Belum ditentukan"}</b></div>
          </div>
        )}

        <div className="module-form">
          <div className="deadline-input-group">
            <label>
              Tenggat Waktu Baru yang Disetujui
              <input type="date" value={extendedDate} onChange={e => setExtendedDate(e.target.value)} />
            </label>
            <div className="quick-days-btn-row">
              <span>Sesuaikan:</span>
              <button type="button" onClick={() => addDays(3)}>+3 Hari</button>
              <button type="button" onClick={() => addDays(7)}>+1 Minggu</button>
              <button type="button" onClick={() => addDays(14)}>+2 Minggu</button>
              <button type="button" onClick={() => addDays(30)}>+1 Bulan</button>
            </div>
          </div>

          <label className="wide">
            Catatan Keputusan Atasan (Opsional)
            <textarea
              rows={2}
              placeholder="Contoh: Disetujui penambahan waktu 7 hari kerja agar output monev diselesaikan maksimal."
              value={decisionNote}
              onChange={e => setDecisionNote(e.target.value)}
            />
          </label>
        </div>

        {message && <p className="form-message">{message}</p>}

        <div className="modal-actions">
          <button type="button" onClick={close}>Batal</button>
          <button type="button" className="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Menyimpan..." : "✓ Setujui Perpanjangan Deadline"}
          </button>
        </div>
      </div>
    </div>
  );
}
