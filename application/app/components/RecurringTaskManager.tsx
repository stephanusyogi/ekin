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

function parseOutputCategories(raw:string){
 if(!raw)return{selected:["Dokumen"],otherText:""};
 const parts=raw.split(/,\s*/),selected:string[]=[];let otherText="";
 for(const part of parts){
  const trimmed=part.trim();if(!trimmed)continue;
  if(trimmed.startsWith("Lain-lain")||trimmed.startsWith("Lainnya")){
   if(!selected.includes("Lain-lain"))selected.push("Lain-lain");
   const colonMatch=trimmed.match(/^Lain-(?:lain|nya):\s*(.*)$/),parenMatch=trimmed.match(/^Lain-(?:lain|nya)\s*\((.*)\)$/);
   if(colonMatch)otherText=colonMatch[1].trim();else if(parenMatch)otherText=parenMatch[1].trim();
  }else{
   if(!selected.includes(trimmed))selected.push(trimmed);
  }
 }
 return{selected:selected.length?selected:["Dokumen"],otherText};
}

function serializeOutputCategories(selected:string[],otherText:string):string{
 if(!selected.length)return"Dokumen";
 const list=selected.map(cat=>{if(cat==="Lain-lain"){const clean=otherText.trim();return clean?`Lain-lain (${clean})`:"Lain-lain"}return cat});
 return list.join(", ");
}
export default function RecurringTaskManager(){
const [tasks,setTasks]=useState<Task[]>([]),[templates,setTemplates]=useState<Template[]>([]),[assignees,setAssignees]=useState<Assignee[]>([]),[units,setUnits]=useState<OrgUnit[]>([]),[performanceSources,setPerformanceSources]=useState<PerformanceSource[]>([]),[form,setForm]=useState(fresh()),[showForm,setShowForm]=useState(false),[editing,setEditing]=useState<Task|null>(null),[reviewingTask,setReviewingTask]=useState<Task|null>(null),[canManageRecurring,setCanManageRecurring]=useState(false),[canCreate,setCanCreate]=useState(false),[canAdmin,setCanAdmin]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[q,setQ]=useState(""),[status,setStatus]=useState("Semua"),[unitFilter,setUnitFilter]=useState("Semua"),[priorityFilter,setPriorityFilter]=useState("Semua"),[typeFilter,setTypeFilter]=useState("Semua"),[deadlineFilter,setDeadlineFilter]=useState("Semua"),[page,setPage]=useState(1);
 const [currentEmail,setCurrentEmail]=useState(""),[progressTask,setProgressTask]=useState<Task|null>(null),[progressHistory,setProgressHistory]=useState<ProgressUpdate[]>([]),[progressForm,setProgressForm]=useState({progress:0,outputRealization:"",completedActivities:"",obstacles:"",notes:""});
 const [canApproveTaskIds,setCanApproveTaskIds]=useState<number[]>([]);
 const load=()=>Promise.all([fetch("/api/recurring-tasks"),fetch("/api/task-assignees"),fetch("/api/monitoring"),fetch("/api/task-performance-sources")]).then(async([tr,ar,mr,pr])=>{const t=await tr.json(),a=await ar.json(),m=await mr.json(),p=await pr.json();if(tr.ok){setTemplates(t.templates||[]);setCanManageRecurring(Boolean(t.canManage))}if(ar.ok){setAssignees(a.assignees||[]);setUnits(a.units||[]);setCanCreate(Boolean(a.canCreate));setCanAdmin(Boolean(a.canAdministerTasks));setCurrentEmail(a.currentEmail||"")}if(mr.ok){setTasks(m.tasks||[]);setCanApproveTaskIds(m.canApproveTaskIds||[])}if(pr.ok)setPerformanceSources(p.sources||[])});
 useEffect(()=>{let active=true;Promise.all([fetch("/api/recurring-tasks"),fetch("/api/task-assignees"),fetch("/api/monitoring"),fetch("/api/task-performance-sources")]).then(async([tr,ar,mr,pr])=>{const t=await tr.json(),a=await ar.json(),m=await mr.json(),p=await pr.json();if(!active)return;if(tr.ok){setTemplates(t.templates||[]);setCanManageRecurring(Boolean(t.canManage))}if(ar.ok){setAssignees(a.assignees||[]);setUnits(a.units||[]);setCanCreate(Boolean(a.canCreate));setCanAdmin(Boolean(a.canAdministerTasks));setCurrentEmail(a.currentEmail||"")}if(mr.ok){setTasks(m.tasks||[]);setCanApproveTaskIds(m.canApproveTaskIds||[])}if(pr.ok)setPerformanceSources(p.sources||[])});return()=>{active=false}},[]);
 const today=new Date().toISOString().slice(0,10),deadlineOf=(task:Task)=>{const d=task.extendedDeadline||task.deadline||"";return d==="Belum ditentukan"?"":d};
 const filtered=useMemo(()=>tasks.filter(t=>{
  const deadline=deadlineOf(t),isCompleted=t.status==="Selesai"||t.progress>=100,isOverdue=Boolean(deadline&&deadline<today&&!isCompleted);
  const picNames=getPicNames(t,assignees);
  const qLower=q.toLowerCase();
  const matchQuery=!q||t.title.toLowerCase().includes(qLower)||t.unit.toLowerCase().includes(qLower)||picNames.some(name=>name.toLowerCase().includes(qLower))||parsePics(t.picEmails).some(email=>email.toLowerCase().includes(qLower));
  return matchQuery&&(status==="Semua"||t.status===status)&&(unitFilter==="Semua"||t.unit.trim().toLowerCase()===unitFilter.trim().toLowerCase())&&(priorityFilter==="Semua"||t.priority===priorityFilter)&&(typeFilter==="Semua"||(typeFilter==="Berulang")===Boolean(t.recurringTemplateId))&&(deadlineFilter==="Semua"||(deadlineFilter==="Melewati deadline"&&isOverdue)||(deadlineFilter==="Belum melewati deadline"&&Boolean(deadline)&&!isOverdue)||(deadlineFilter==="Tanpa deadline"&&!deadline));
 }),[tasks,assignees,q,status,unitFilter,priorityFilter,typeFilter,deadlineFilter,today]);
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>setPage(1),[q,status,unitFilter,priorityFilter,typeFilter,deadlineFilter]);const pages=Math.max(1,Math.ceil(filtered.length/25)),rows=filtered.slice((page-1)*25,page*25);const active=tasks.filter(t=>t.status!=="Selesai"&&t.progress<100),completed=tasks.filter(t=>t.status==="Selesai"||t.progress>=100),overdue=active.filter(t=>Boolean(deadlineOf(t)&&deadlineOf(t)<today)),average=tasks.length?Math.round(tasks.reduce((s,t)=>s+t.progress,0)/tasks.length):0;
 const togglePic=(email:string)=>setForm({...form,picEmails:form.picEmails.includes(email)?form.picEmails.filter(x=>x!==email):[...form.picEmails,email]});
 const save=async()=>{setSaving(true);setMessage("");const recurring=form.mode==="Berulang",r=await fetch(recurring?"/api/recurring-tasks":"/api/tasks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)}),d=await r.json();setSaving(false);if(!r.ok){setMessage(d.error||"To-Do belum tersimpan");return}setForm(fresh());setShowForm(false);setMessage(recurring?"Template berulang berhasil diaktifkan.":"To-Do berhasil dibuat.");load()};
 const saveEdit=async()=>{if(!editing)return;setSaving(true);const r=await fetch(canAdmin?"/api/admin/tasks":"/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({...editing,action:canAdmin?undefined:"supervisor_edit",picEmails:parsePics(editing.picEmails)})}),d=await r.json();setSaving(false);if(!r.ok){setMessage(d.error||"Perubahan belum tersimpan");return}setEditing(null);setMessage("To-Do berhasil diperbarui.");load()};
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
 const handleReturnRevision=async(task:Task,decisionNote:string)=>{
  setSaving(true);
  try{
   const r=await fetch("/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:task.id,action:"needs_revision",decisionNote})}),d=await r.json();
   setSaving(false);
   if(!r.ok){setMessage(d.error||"Gagal mengembalikan To-Do");return}
   setReviewingTask(null);
   setMessage("To-Do telah dikembalikan kepada staf untuk perbaikan.");
   load();
  }catch(err:any){setSaving(false);setMessage(err?.message||"Gagal menyimpan keputusan.")}
 };
 const handleReject=async(task:Task,decisionNote:string)=>{
  setSaving(true);
  try{
   const r=await fetch("/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:task.id,action:"reject",decisionNote})}),d=await r.json();
   setSaving(false);
   if(!r.ok){setMessage(d.error||"Gagal menolak To-Do");return}
   setReviewingTask(null);
   setMessage("To-Do telah ditolak.");
   load();
  }catch(err:any){setSaving(false);setMessage(err?.message||"Gagal menyimpan keputusan.")}
 };
 const remove=async(task:Task)=>{const reason=prompt(`Alasan menghapus To-Do “${task.title}” (minimal 5 karakter):`);if(!reason||reason.trim().length<5){setMessage("Penghapusan dibatalkan. Alasan minimal 5 karakter.");return}const r=await fetch(`/api/admin/tasks?id=${task.id}&reason=${encodeURIComponent(reason.trim())}`,{method:"DELETE"});const d=await r.json();if(r.ok){setMessage("To-Do berhasil dihapus dan dicatat dalam audit.");load()}else setMessage(d.error||"To-Do belum dapat dihapus.")};
 const changeTemplate=async(t:Template,next:Template["status"])=>{await fetch("/api/recurring-tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:t.id,status:next})});load()};
 const canUpdate=(task:Task)=>Boolean(currentEmail&&parsePics(task.picEmails).map(x=>x.toLowerCase()).includes(currentEmail.toLowerCase()));
 const canEditUnstarted=(task:Task)=>task.createdBy.toLowerCase()===currentEmail.toLowerCase()&&task.status==="Baru"&&task.progress===0;
 const sourceFor=(task:Task)=>performanceSources.find(source=>source.indicatorId===task.sourcePerformanceIndicatorId);
 const openProgress=async(task:Task)=>{setMessage("");setProgressTask(task);setProgressForm({progress:task.progress,outputRealization:task.output||"",completedActivities:"",obstacles:"",notes:""});setProgressHistory([]);try{const r=await fetch(`/api/tasks?taskId=${task.id}`);if(r.ok){const d=await r.json();setProgressHistory(d.history||[])}}catch{}};
 const saveProgress=async()=>{if(!progressTask)return;if(!progressForm.completedActivities.trim()){setMessage("Kegiatan yang sudah dilaksanakan wajib diisi.");return}if(progressForm.progress===100&&!progressForm.outputRealization.trim()){setMessage("Realisasi output wajib diisi untuk progres 100%.");return}setSaving(true);try{const r=await fetch("/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:progressTask.id,...progressForm})}),d=await r.json();setSaving(false);if(!r.ok){setMessage(d.error||"Progress belum tersimpan.");return}setProgressTask(null);setMessage(progressForm.progress===100?"Progress 100% dikirim untuk verifikasi atasan.":"Progress berhasil diperbarui.");load()}catch(e:any){setSaving(false);setMessage(e?.message||"Progress belum tersimpan.")}};
 const taskApproval=async(task:Task,action:"request_approval"|"approve"|"reject"|"needs_revision"|"verify_complete"|"verify_revision")=>{const needsNote=["reject","needs_revision","verify_revision"].includes(action),decisionNote=needsNote?(prompt(action==="reject"?"Alasan penolakan:":"Catatan perbaikan:")||""):"";if(needsNote&&!decisionNote.trim())return;const r=await fetch("/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:task.id,action,decisionNote})}),d=await r.json();setMessage(r.ok?(action==="request_approval"?"To-Do telah diajukan kepada atasan.":action==="verify_complete"?"Pekerjaan telah diverifikasi dan dinyatakan selesai.":action==="verify_revision"?"Pekerjaan dikembalikan untuk perbaikan.":"Keputusan persetujuan berhasil disimpan."):(d.error||"Tindakan belum berhasil."));if(r.ok)load()};
 const hasActions=canAdmin||tasks.some(t=>canUpdate(t)||canApproveTaskIds.includes(t.id)||canEditUnstarted(t));
 return <section className="todo-database-page"><div className="page-title"><div><p>DATABASE PEKERJAAN</p><h1>To-Do & Progres</h1><span>Maksimal 25 baris per halaman · sesuai cakupan kewenangan.</span></div>{canCreate&&<button className="primary" onClick={()=>{setMessage("");setShowForm(true)}}>＋ Buat To-Do</button>}</div>{message&&<div className="todo-success">{message}</div>}
 <div className="todo-summary progress-report"><article><b>{tasks.length}</b><span>Total pekerjaan</span></article><article><b>{active.length}</b><span>Masih aktif</span></article><article><b>{completed.length}</b><span>Selesai</span></article><article><b>{average}%</b><span>Rata-rata progres</span></article><article className={`${overdue.length?"warning ":""}filter-link`} role="button" tabIndex={0} aria-label={`Tampilkan ${overdue.length} To-Do yang melewati deadline`} onClick={()=>setDeadlineFilter("Melewati deadline")} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setDeadlineFilter("Melewati deadline")}}><b>{overdue.length}</b><span>Melewati deadline · klik untuk melihat</span></article></div>
 <div className="todo-toolbar advanced"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari pekerjaan, unit, atau nama PIC..."/><select aria-label="Filter jenis To-Do" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>{["Semua","Sekali","Berulang"].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Filter unit" value={unitFilter} onChange={e=>setUnitFilter(e.target.value)}><option>Semua</option>{Array.from(new Set(tasks.map(t=>t.unit))).sort().map(x=><option key={x}>{x}</option>)}</select><select aria-label="Filter prioritas" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>{["Semua","Rendah","Sedang","Tinggi","Urgent"].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Filter status" value={status} onChange={e=>setStatus(e.target.value)}>{["Semua","Baru","Ditolak","Dikerjakan","Menunggu Verifikasi","Verifikasi Final","Perbaikan","Selesai"].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Filter deadline" value={deadlineFilter} onChange={e=>setDeadlineFilter(e.target.value)}>{["Semua","Melewati deadline","Belum melewati deadline","Tanpa deadline"].map(x=><option key={x}>{x}</option>)}</select></div>
 <div className="employee-table-wrap"><table className="employee-table todo-table"><thead><tr><th>No.</th><th>Uraian</th><th>Jenis</th><th>PIC</th><th>Unit</th><th>Prioritas</th><th>Deadline</th><th>Status</th><th>Progress</th><th>Output</th><th>Catatan</th><th>Persetujuan/Verifikasi</th>{hasActions&&<th>Aksi</th>}</tr></thead><tbody>{rows.length?rows.map((t,i)=>{const pk=sourceFor(t),pkLabel=t.sourcePkLabel||(pk?`${pk.ownerPosition} · ${pk.indicator}`:"");const picNames=getPicNames(t,assignees);return <tr key={t.id}><td>{(page-1)*25+i+1}</td><td><b>{t.title}</b>{pkLabel&&<small className="task-pk-source">PK: {pkLabel}</small>}</td><td><span className="access-badge">{t.recurringTemplateId?"Berulang":"Sekali"}</span></td><td>{picNames.length?<div className="todo-pic-list">{picNames.slice(0,4).map((name,idx)=><span key={idx} className="todo-pic-badge" title={name}>{name}</span>)}{picNames.length>4&&<span className="todo-pic-badge more" title={picNames.slice(4).join(", ")}>+{picNames.length-4} lainnya</span>}</div>:<span style={{color:"#94a3b8"}}>—</span>}</td><td>{t.unit}</td><td>{t.priority}</td><td>{t.extendedDeadline||t.deadline||"—"}</td><td><span className="status-badge">{t.status}</span></td><td><div className="table-progress"><i style={{width:`${t.progress}%`}}/></div>{t.progress}%</td><td>{t.output||"—"}</td><td>{t.notes||"—"}</td><td><b>{t.approvalStatus||"Tidak Perlu Persetujuan"}</b><small>{t.approvalNote||t.verificationStatus}</small></td>{hasActions&&<td><div className="row-actions">{canUpdate(t)&&t.approvalStatus==="Draft"&&<button onClick={()=>taskApproval(t,"request_approval")}>Minta Persetujuan</button>}{canUpdate(t)&&!["Draft","Menunggu Persetujuan","Ditolak"].includes(t.approvalStatus)&&t.status!=="Selesai"&&t.status!=="Verifikasi Final"&&<button onClick={()=>{setMessage("");openProgress(t)}}>Update Progress</button>}{canApproveTaskIds.includes(t.id)&&t.approvalStatus==="Menunggu Persetujuan"&&<><button className="primary" onClick={()=>{setMessage("");setReviewingTask({...t})}}>Review & Sesuaikan</button><button onClick={()=>taskApproval(t,"approve")}>Setujui Langsung</button><button className="danger" onClick={()=>taskApproval(t,"reject")}>Tolak</button></>}{canApproveTaskIds.includes(t.id)&&t.status==="Verifikasi Final"&&<><button onClick={()=>taskApproval(t,"verify_complete")}>Verifikasi Selesai</button><button onClick={()=>taskApproval(t,"verify_revision")}>Minta Perbaikan</button></>}{(canAdmin||canApproveTaskIds.includes(t.id)||canEditUnstarted(t))&&t.status!=="Selesai"&&t.status!=="Verifikasi Final"&&t.approvalStatus!=="Menunggu Persetujuan"&&<button onClick={()=>{setMessage("");setEditing({...t})}}>{canAdmin||canApproveTaskIds.includes(t.id)?"Sesuaikan To-Do":"Edit sebelum dikerjakan"}</button>}{canAdmin&&<button className="danger" onClick={()=>remove(t)}>Hapus</button>}</div></td>}</tr>}):<tr><td colSpan={hasActions?13:12} className="empty-state">Belum ada To-Do yang sesuai dengan filter.</td></tr>}</tbody></table></div>
 <div className="pagination"><span>Menampilkan {filtered.length?((page-1)*25+1):0}–{Math.min(page*25,filtered.length)} dari {filtered.length}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>Sebelumnya</button><b>{page} / {pages}</b><button disabled={page>=pages} onClick={()=>setPage(page+1)}>Berikutnya</button></div></div>
 {templates.length>0&&<section className="template-manager"><div><b>Template To-Do Berulang</b><span>{templates.length} template</span></div><div className="template-list compact">{templates.map(t=><article key={t.id}><div><b>{t.title}</b><span>{t.unit} · {t.frequency} · hari ke-{t.generationDay}</span></div><em className={t.status.toLowerCase()}>{t.status}</em>{canManageRecurring&&<select value={t.status} onChange={e=>changeTemplate(t,e.target.value as Template["status"])}><option>Aktif</option><option>Dijeda</option><option>Nonaktif</option></select>}</article>)}</div></section>}
 {showForm&&<CreateModal form={form} setForm={setForm} units={units} assignees={assignees} performanceSources={performanceSources} canRecurring={canManageRecurring} togglePic={togglePic} close={()=>setShowForm(false)} save={save} saving={saving} message={message}/>} {editing&&<EditModal task={editing} setTask={setEditing} units={units} assignees={assignees} performanceSources={performanceSources} close={()=>setEditing(null)} save={saveEdit} saving={saving} message={message}/>} {reviewingTask&&<ReviewModal task={reviewingTask} assignees={assignees} units={units} close={()=>{setReviewingTask(null);setMessage("")}} onApproveWithAdjustments={handleApproveWithAdjustments} onReturnRevision={handleReturnRevision} onReject={handleReject} saving={saving} message={message}/>} {progressTask&&<ProgressModal task={progressTask} form={progressForm} setForm={setProgressForm} history={progressHistory} assignees={assignees} close={()=>{setProgressTask(null);setMessage("")}} save={saveProgress} saving={saving} message={message}/>}</section>;
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

function ReviewModal({task,assignees=[],units=[],close,onApproveWithAdjustments,onReturnRevision,onReject,saving,message}:any){
 const [pics,setPics]=useState<string[]>(parsePics(task.picEmails));
 const [deadline,setDeadline]=useState<string>(task.deadline||"");
 const [priority,setPriority]=useState<string>(task.priority||"Sedang");
 const [decisionNote,setDecisionNote]=useState<string>("");
 const [actionType,setActionType]=useState<"approve"|"revision"|"reject">("approve");

 const togglePic=(email:string)=>{
  setPics(prev=>prev.includes(email)?prev.filter(x=>x!==email):[...prev,email]);
 };

 const addDays=(days:number)=>{
  const base=deadline?new Date(deadline):new Date();
  const d=new Date(base.getTime() + days * 86400000);
  setDeadline(d.toISOString().slice(0,10));
 };

 const creator=assignees.find((a:Assignee)=>a.email?.toLowerCase()===task.createdBy.toLowerCase());

 const handleSubmit=()=>{
  if(actionType==="approve"){
   if(pics.length===0){
    alert("Harap pilih minimal 1 staf pelaksana (PIC).");
    return;
   }
   onApproveWithAdjustments(task,{picEmails:pics,deadline,priority,decisionNote});
  }else if(actionType==="revision"){
   if(!decisionNote.trim()){
    alert("Harap berikan catatan perbaikan untuk staf pengaju.");
    return;
   }
   onReturnRevision(task,decisionNote);
  }else if(actionType==="reject"){
   if(!decisionNote.trim()){
    alert("Harap berikan alasan penolakan To-Do.");
    return;
   }
   onReject(task,decisionNote);
  }
 };

 return (
  <div className="modal-backdrop" onMouseDown={close}>
   <div className="modal todo-review-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}>
    <span>SUPERVISI & PENYESUAIAN ATASAN</span>
    <Title title={`Review To-Do: “${task.title}”`} close={close}/>

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

    <div className="review-action-selector">
     <button
      type="button"
      className={actionType==="approve"?"active approve":""}
      onClick={()=>setActionType("approve")}
     >
      ✓ Setujui & Berikan Penugasan
     </button>
     <button
      type="button"
      className={actionType==="revision"?"active revision":""}
      onClick={()=>setActionType("revision")}
     >
      ↺ Minta Perbaikan Staf
     </button>
     <button
      type="button"
      className={actionType==="reject"?"active reject":""}
      onClick={()=>setActionType("reject")}
     >
      ✕ Tolak To-Do
     </button>
    </div>

    {actionType==="approve"?(
     <div className="review-adjustments-body">
      <p className="review-guide-hint">
       💡 <b>Fleksibilitas Kasubag:</b> Anda dapat menambah atau mengurangi staf pelaksana (misal menambahkan staf lain untuk pembagian beban kerja), serta menyesuaikan tenggat waktu bila perkiraan waktu awal tentatif.
      </p>

      {/* 1. Dynamic PIC adjustment */}
      <PicPicker emails={pics} assignees={assignees} unit={task.unit} toggle={togglePic}/>

      {/* 2. Tentative deadline & priority adjustment */}
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

      {/* 3. Decision note */}
      <label className="wide review-note-label">
       Catatan / Arahan Atasan (Opsional untuk Persetujuan)
       <textarea
        rows={2}
        placeholder="Contoh: Disetujui dengan penambahan staf Mas Andre untuk membantu dan perpanjangan waktu 7 hari."
        value={decisionNote}
        onChange={e=>setDecisionNote(e.target.value)}
       />
      </label>
     </div>
    ):(
     <div className="review-rejection-body">
      <label className="wide review-note-label required">
       {actionType==="revision"?"Catatan Arahan Perbaikan (Wajib Diisi)":"Alasan Penolakan (Wajib Diisi)"}
       <textarea
        rows={4}
        autoFocus
        placeholder={actionType==="revision"?"Jelaskan uraian, output, atau hal yang perlu diperbaiki staf sebelum diajukan kembali...":"Jelaskan alasan To-Do tidak dapat disetujui..."}
        value={decisionNote}
        onChange={e=>setDecisionNote(e.target.value)}
       />
      </label>
     </div>
    )}

    {message&&<p className="form-message">{message}</p>}

    <div className="modal-actions">
     <button type="button" onClick={close}>Batal</button>
     <button
      type="button"
      className={actionType==="approve"?"primary":actionType==="revision"?"secondary":"danger"}
      onClick={handleSubmit}
      disabled={saving}
     >
      {saving?"Menyimpan...":actionType==="approve"?"✓ Simpan Penyesuaian & Setujui":actionType==="revision"?"↺ Kirim Catatan Perbaikan":"✕ Tolak To-Do"}
     </button>
    </div>
   </div>
  </div>
 );
}
function OutputCategoryPicker({value,change}:any){
 const {selected,otherText}=parseOutputCategories(value);
 const toggleCategory=(cat:string)=>{
  let next:string[];
  if(selected.includes(cat)){
   next=selected.filter(x=>x!==cat);
   if(!next.length)next=["Dokumen"];
  }else{
   next=[...selected,cat];
  }
  change(serializeOutputCategories(next,otherText));
 };
 const updateOtherText=(text:string)=>{
  change(serializeOutputCategories(selected,text));
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
      <input type="text" placeholder="Contoh: Aplikasi web, publikasi media, spanduk, dll." value={otherText} onChange={e=>updateOtherText(e.target.value)}/>
     </label>
    </div>
   )}
  </fieldset>
 );
}
function Title({title,close}:any){return <div className="modal-title-row"><div><h3>{title}</h3><p>Perubahan disimpan ke database To-Do.</p></div><button aria-label="Tutup" onClick={close}>×</button></div>}
function Actions({close,save,saving,label,message}:any){return <>{message&&<p className="form-message">{message}</p>}<div className="modal-actions"><button onClick={close}>Batal</button><button className="primary" onClick={save} disabled={saving}>{saving?"Menyimpan...":label}</button></div></>}
