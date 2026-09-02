"use client";

import { useEffect, useState } from "react";
import AttendanceCenter from "./components/AttendanceCenter";
import AttendanceSettings from "./components/AttendanceSettings";
import MonitoringCenter from "./components/MonitoringCenter";
import OrganizationSettings from "./components/OrganizationSettings";
import RecurringTaskManager from "./components/RecurringTaskManager";
import MonthlyAttendanceReport from "./components/MonthlyAttendanceReport";
import PerformanceAgreementCenter from "./components/PerformanceAgreementCenter";
import SecurityCenter from "./components/SecurityCenter";
import AgendaCenter, { AgendaToday } from "./components/AgendaCenter";

type Task = {
  id: number;
  title: string;
  unit: string;
  due: string;
  progress: number;
  status: string;
  output?: string;
  notes?: string;
};
type ProgressUpdate = {
  id: number;
  employeeEmail: string;
  progress: number;
  outputRealization: string;
  completedActivities: string;
  obstacles: string;
  notes: string;
  createdAt: string;
};
type Attendance = {
  checkOut?: string | null;
  workOutput?: string;
  attendanceStatus: string;
  lateMinutes: number;
  replacementMinutes: number;
  morningSession: boolean;
};
type Employee = {
  id: number;
  fullName: string;
  employeeNumber: string;
  email: string | null;
  phone: string;
  position: string;
  unitSubsection: string;
  directSupervisorId: number | null;
  organizationPositionId: number | null;
  operatorAttendance: boolean;
  operatorSakip: boolean;
  employeeStatus: "Aktif" | "Nonaktif";
  accountStatus: "Aktif" | "Dinonaktifkan";
  accessLevel:
    | "Super Admin"
    | "Admin"
    | "Editor"
    | "User"
    | "Viewer"
    | "Operator";
};
type Holiday = {
  id: number;
  holidayDate: string;
  title: string;
  description: string;
};
type EmployeeOrgPosition = { id:number;name:string;level:string;unitName:string;reportsToPositionId:number|null;status:string;assignedEmployeeId:number|null;assignedEmployeeName:string|null };
const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
        <path d="M2 19h22" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 13h6M9 17h6" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
};

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [clockedIn, setClockedIn] = useState(false);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [activeOtherAttendance, setActiveOtherAttendance] = useState<{
    type: string;
    startDate: string;
    endDate: string;
    durationDays: number;
  } | null>(null);
  const [schedule, setSchedule] = useState({
    start: "07:30",
    end: "16:00",
    attendanceCutoff: "08:30",
    replacementMultiplier: 1,
    canCheckIn: true,
    canCheckOut: true,
    checkInWindowEnabled: false,
    checkInOpenTime: "05:00",
    checkInCloseTime: "08:30",
    checkOutWindowEnabled: false,
    checkOutOpenTime: "16:00",
    checkOutCloseTime: "23:59",
  });
  const [day, setDay] = useState({ isHoliday: false, holidayName: "" });
  const [announcement, setAnnouncement] = useState<{
    title: string;
    date: string;
    description: string;
  } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeePositions, setEmployeePositions] = useState<EmployeeOrgPosition[]>([]);
  const [showEmployee, setShowEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    employeeNumber: "",
    email: "",
    phone: "",
    organizationPositionId: null as number | null,
    employeeStatus: "Aktif" as Employee["employeeStatus"],
    accountStatus: "Aktif" as Employee["accountStatus"],
    accessLevel: "User" as Employee["accessLevel"],
    operatorAttendance: false,
    operatorSakip: false,
  });
  const [ruleForm, setRuleForm] = useState({
    mondayThursdayStart: "07:30",
    mondayThursdayEnd: "16:00",
    fridayStart: "07:30",
    fridayEnd: "16:30",
    graceMinutes: 0,
    replacementMultiplier: 1,
    morningCutoff: "08:30",
    dailyCloseEnabled: false,
    dailyCloseTime: "18:00",
  });
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayForm, setHolidayForm] = useState({
    date: "",
    title: "",
    description: "",
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progressTask, setProgressTask] = useState<Task | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressUpdate[]>([]);
  const [progressForm, setProgressForm] = useState({progress:0,outputRealization:"",completedActivities:"",obstacles:"",notes:""});
  const [summary, setSummary] = useState({
    activeTodoCount: 0,
    notificationCount: 0,
    completedCount: 0,
    attentionCount: 0,
    averageProgress: 0,
    pkCount: 0,
    pkPending: 0,
    pkProgress: 0,
  });
  const [showCheckout, setShowCheckout] = useState(false);
  const [workOutput, setWorkOutput] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentRole, setCurrentRole] = useState("user");
  const [currentPermissions,setCurrentPermissions]=useState({attendanceOperator:false,sakipOperator:false});
  const [currentName, setCurrentName] = useState("Pengguna e Kinerja");
  const [accessState, setAccessState] = useState<
    "loading" | "authorized" | "login" | "denied" | "replaced"
  >("loading");
  const [accessMessage, setAccessMessage] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2400);
  };
  const loadDashboard = async () => {
    const response = await fetch("/api/dashboard-summary");
    if (response.ok) {
      const data = await response.json();
      setTasks(data.tasks || []);
      setSummary({
        activeTodoCount: data.activeTodoCount || 0,
        notificationCount: data.notificationCount || 0,
        completedCount: data.completedCount || 0,
        attentionCount: data.attentionCount || 0,
        averageProgress: data.averageProgress || 0,
        pkCount: data.pkCount || 0,
        pkPending: data.pkPending || 0,
        pkProgress: data.pkProgress || 0,
      });
    }
  };
  useEffect(() => {
    if (accessState !== "authorized") return;
    Promise.all([
      fetch("/api/dashboard-summary"),
      fetch("/api/attendance"),
      fetch("/api/announcements"),
    ])
      .then(async ([taskRes, attendanceRes, announcementRes]) => {
        if (taskRes.ok) {
          const data = await taskRes.json();
          setTasks(data.tasks || []);
          setSummary({
            activeTodoCount: data.activeTodoCount || 0,
            notificationCount: data.notificationCount || 0,
            completedCount: data.completedCount || 0,
            attentionCount: data.attentionCount || 0,
            averageProgress: data.averageProgress || 0,
            pkCount: data.pkCount || 0,
            pkPending: data.pkPending || 0,
            pkProgress: data.pkProgress || 0,
          });
        }
        if (attendanceRes.ok) {
          const data = await attendanceRes.json();
          setAttendance(data.attendance);
          setActiveOtherAttendance(data.activeOther || null);
          setClockedIn(Boolean(data.attendance));
          setSchedule(data.schedule);
          setDay(data.day);
        }
        if (announcementRes.ok) {
          const data = await announcementRes.json();
          setAnnouncement(data.announcements[0] || null);
        }
      })
      .catch(() => undefined);
  }, [accessState]);
  useEffect(() => {
    let stopped=false;
    const verify=async()=>{
      const session=await fetch("/api/session",{method:"POST"});
      if(session.status===409){const d=await session.json();if(!stopped){setAccessMessage(d.error||"Akun Anda telah masuk dari perangkat lain.");setAccessState("replaced");}return;}
      if(!session.ok){const d=await session.json();if(!stopped){setAccessMessage(d.error||"Akses tidak tersedia");setAccessState(session.status===401?"login":"denied");}return;}
      fetch("/api/me")
      .then(async (r) => {
        const d = await r.json();
        if (stopped)return;
        if (r.ok) {
          setCurrentRole(d.user?.role || "user");
          setCurrentPermissions(d.user?.permissions||{attendanceOperator:false,sakipOperator:false});
          setCurrentName(d.user?.name || d.user?.email || "Pengguna e Kinerja");
          setAccessState("authorized");
        } else if(r.status===409){
          setAccessMessage(d.error||"Akun Anda telah masuk dari perangkat lain.");
          setAccessState("replaced");
        } else {
          setAccessMessage(d.error || "Akses tidak tersedia");
          setAccessState(r.status === 401 ? "login" : "denied");
        }
      })
      .catch(() => {
        setAccessMessage("Identitas belum dapat diverifikasi");
        setAccessState("login");
      });
    };
    verify().catch(()=>{if(!stopped){setAccessMessage("Identitas belum dapat diverifikasi");setAccessState("login");}});
    return()=>{stopped=true};
  }, []);
  useEffect(()=>{
    if(accessState!=="authorized")return;
    const check=async()=>{const r=await fetch("/api/session");if(r.status===409){const d=await r.json();setAccessMessage(d.error||"Akun Anda telah masuk dari perangkat lain.");setAccessState("replaced");}};
    const timer=setInterval(check,15000);
    const visible=()=>{if(document.visibilityState==="visible")check()};
    document.addEventListener("visibilitychange",visible);
    return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",visible)};
  },[accessState]);
  const takeOverSession=async()=>{
    setAccessState("loading");
    const r=await fetch("/api/session?takeover=1",{method:"POST"});
    if(r.ok){window.location.reload();return;}
    const d=await r.json().catch(()=>({}));setAccessMessage(d.error||"Sesi belum dapat diambil alih");setAccessState(r.status===401?"login":"denied");
  };
  const checkIn = async () => {
    if (clockedIn || saving) {
      notify("Absensi Anda sudah tercatat");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "check_in" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAttendance(data.attendance);
      setClockedIn(true);
      notify(
        day.isHoliday
          ? "Absensi hari libur berhasil dicatat"
          : "Absen masuk berhasil dicatat",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Absensi belum tercatat. Silakan coba lagi",
      );
    } finally {
      setSaving(false);
    }
  };
  const checkOut = async () => {
    if (!clockedIn) {
      notify("Lakukan absen masuk terlebih dahulu");
      return;
    }
    if (attendance?.checkOut) {
      notify("Absen pulang sudah tercatat");
      return;
    }
    if (!workOutput.trim()) {
      notify("Isi Output Pekerjaan terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "check_out", workOutput }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAttendance(data.attendance);
      setShowCheckout(false);
      setWorkOutput("");
      notify("Absen pulang dan Output Pekerjaan berhasil dicatat");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Absen pulang belum tercatat",
      );
    } finally {
      setSaving(false);
    }
  };
  const openProgress = async (task: Task) => {
    setProgressTask(task);
    setProgressForm({progress:task.progress,outputRealization:task.output||"",completedActivities:"",obstacles:"",notes:""});
    setProgressHistory([]);
    const response=await fetch(`/api/tasks?taskId=${task.id}`);
    if(response.ok){const data=await response.json();setProgressHistory(data.history||[])}
  };
  const saveProgress = async () => {
    if(!progressTask)return;
    if(!progressForm.completedActivities.trim()){notify("Isi kegiatan yang sudah dilaksanakan");return}
    if(progressForm.progress===100&&!progressForm.outputRealization.trim()){notify("Isi realisasi output untuk progres 100%");return}
    setSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: progressTask.id, ...progressForm }),
      });
      const data=await response.json();
      if (!response.ok) throw new Error(data.error||"Progres belum tersimpan");
      await loadDashboard();
      setProgressTask(null);
      notify(progressForm.progress===100?"Progres 100% dikirim untuk verifikasi atasan":"Progres tugas berhasil diperbarui");
    } catch(error) {
      notify(error instanceof Error?error.message:"Progres belum tersimpan. Silakan coba lagi");
    } finally {setSaving(false)}
  };
  useEffect(() => {
    if (active === "Data Pegawai")
      fetch("/api/employees")
        .then(async (r) => {
          const d = await r.json();
          if (r.ok) { setEmployees(d.employees); setEmployeePositions(d.positions || []); }
          else notify(d.error);
        })
        .catch(() => notify("Data pegawai belum dapat dimuat"));
  }, [active]);
  const openEmployee = (employee?: Employee) => {
    setEditingEmployee(employee || null);
    setEmployeeForm(
      employee
        ? {
            fullName: employee.fullName,
            employeeNumber: employee.employeeNumber,
            email: employee.email || "",
            phone: employee.phone,
            organizationPositionId: employee.organizationPositionId,
            employeeStatus: employee.employeeStatus,
            accountStatus: employee.accountStatus,
            accessLevel: employee.accessLevel,
            operatorAttendance: employee.operatorAttendance,
            operatorSakip: employee.operatorSakip,
          }
        : {
            fullName: "",
            employeeNumber: "",
            email: "",
            phone: "",
            organizationPositionId: null,
            employeeStatus: "Aktif",
            accountStatus: "Dinonaktifkan",
            accessLevel: "User",
            operatorAttendance: false,
            operatorSakip: false,
          },
    );
    setShowEmployee(true);
  };
  const saveEmployee = async () => {
    if (
      [
        employeeForm.fullName,
        employeeForm.employeeNumber,
        employeeForm.phone,
      ].some((v) => !v.trim()) || !employeeForm.organizationPositionId
    ) {
      notify("Lengkapi data wajib pegawai");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/employees", {
        method: editingEmployee ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...employeeForm, id: editingEmployee?.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEmployees(
        editingEmployee
          ? employees.map((e) =>
              e.id === data.employee.id ? data.employee : e,
            )
          : [...employees, data.employee].sort((a, b) =>
              a.fullName.localeCompare(b.fullName),
            ),
      );
      setShowEmployee(false);
      notify(
        `Data pegawai berhasil ${editingEmployee ? "diperbarui" : "ditambahkan"}`,
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Data pegawai belum tersimpan",
      );
    } finally {
      setSaving(false);
    }
  };
  const deleteEmployee = async (employee: Employee) => {
    const reason=window.prompt(`Alasan menonaktifkan ${employee.fullName} (minimal 5 karakter):`);
    if(!reason||reason.trim().length<5){notify("Penonaktifan dibatalkan. Alasan minimal 5 karakter.");return;}
    const response = await fetch(`/api/employees?id=${employee.id}&reason=${encodeURIComponent(reason.trim())}`, {
      method: "DELETE",
    });
    if (response.ok) {
      const data=await response.json();setEmployees(employees.map(e=>e.id===employee.id?data.employee:e));
      notify("Pegawai dan akunnya berhasil dinonaktifkan");
    } else notify("Data pegawai belum dapat dinonaktifkan");
  };
  useEffect(() => {
    if (active !== "Rule Absensi") return;
    Promise.all([
      fetch("/api/admin/attendance-settings"),
      fetch("/api/admin/holidays"),
    ])
      .then(async ([settingsRes, holidaysRes]) => {
        const s = await settingsRes.json();
        const h = await holidaysRes.json();
        if (settingsRes.ok)
          setRuleForm({
            mondayThursdayStart: s.settings.mondayThursdayStart,
            mondayThursdayEnd: s.settings.mondayThursdayEnd,
            fridayStart: s.settings.fridayStart,
            fridayEnd: s.settings.fridayEnd,
            graceMinutes: 0,
            replacementMultiplier: 1,
            morningCutoff: s.settings.morningCutoff || "08:30",
            dailyCloseEnabled: Boolean(s.settings.dailyCloseEnabled),
            dailyCloseTime: s.settings.dailyCloseTime || "18:00",
          });
        if (holidaysRes.ok) setHolidays(h.holidays);
      })
      .catch(() => notify("Rule absensi belum dapat dimuat"));
  }, [active]);
  const saveRules = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/attendance-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ruleForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      notify("Rule absensi berhasil disimpan");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Rule belum tersimpan");
    } finally {
      setSaving(false);
    }
  };
  const addHoliday = async () => {
    if (!holidayForm.date || !holidayForm.title.trim()) {
      notify("Tanggal dan nama hari libur wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(holidayForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setHolidays(
        [
          ...holidays.filter(
            (h) =>
              h.id !== data.holiday.id &&
              h.holidayDate !== data.holiday.holidayDate,
          ),
          data.holiday,
        ].sort((a, b) => a.holidayDate.localeCompare(b.holidayDate)),
      );
      setHolidayForm({ date: "", title: "", description: "" });
      notify("Hari libur berhasil ditambahkan");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Hari libur belum tersimpan",
      );
    } finally {
      setSaving(false);
    }
  };
  const deleteHoliday = async (holiday: Holiday) => {
    const response = await fetch(`/api/admin/holidays?id=${holiday.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setHolidays(holidays.filter((h) => h.id !== holiday.id));
      notify("Hari libur berhasil dihapus");
    } else notify("Hari libur belum dapat dihapus");
  };
  const isSystemOwner = currentRole === "super_user";
  const canConfigure = ["super_user", "super_admin"].includes(currentRole);
  const canEditEmployees = ["super_user", "super_admin"].includes(currentRole);
  const canManageEmployees = ["super_user", "super_admin", "admin"].includes(
    currentRole,
  );
  const canPrintAllAttendance = currentPermissions.attendanceOperator || [
    "super_user",
    "super_admin",
    "admin",
    "operator",
  ].includes(currentRole);
  const nav = [
    ["grid", "Dashboard"],
    ...(!isSystemOwner ? [["clock", "Absensi"]] : []),
    ["check", "To-Do & Progres"],
    ["clock", "Agenda Kegiatan"],
    ["file", "Perjanjian Kinerja"],
    ["chart", "Monitoring"],
    ...(canManageEmployees ? [["users", "Data Pegawai"]] : []),
    ...(canConfigure
      ? [
          ["users", "Struktur Organisasi"],
          ["clock", "Setting Absensi"],
        ]
      : []),
    ...(canPrintAllAttendance ? [["file", "Laporan Absensi"]] : []),
    ...(canManageEmployees ? [["users", "Keamanan Sistem"]] : []),
  ];

  if (accessState !== "authorized")
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="login-brand">
            <div className="brandmark">e</div>
            <div>
              <b>e Kinerja</b>
              <span>Sistem Kinerja Pegawai</span>
            </div>
          </div>
          {accessState === "loading" ? (
            <>
              <h1>Memeriksa akses…</h1>
              <p>Mohon tunggu sebentar.</p>
            </>
          ) : accessState === "login" ? (
            <>
              <span className="login-kicker">AKSES PEGAWAI</span>
              <h1>Masuk ke e Kinerja</h1>
              <p>
                Gunakan akun Google yang terdaftar pada Data Pegawai atau Akun Sistem.
              </p>
              <a
                className="login-button"
                href="/api/auth/google"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: "middle" }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Masuk dengan Google
              </a>
              <small>
                Pengunjung tanpa akun terdaftar tidak dapat membuka data
                aplikasi.
              </small>
            </>
          ) : accessState === "replaced" ? (
            <>
              <span className="login-kicker denied">SESI DIHENTIKAN</span>
              <h1>Akun digunakan di perangkat lain</h1>
              <p>{accessMessage}</p>
              <button className="login-button" type="button" onClick={takeOverSession}>
                Masuk kembali di perangkat ini
              </button>
              <small>Jika dilanjutkan, sesi pada perangkat lain akan otomatis keluar.</small>
            </>
          ) : (
            <>
              <span className="login-kicker denied">AKSES DITOLAK</span>
              <h1>Akun belum terdaftar</h1>
              <p>{accessMessage}</p>
              <a
                className="login-button secondary"
                href="/api/auth/logout"
              >
                Keluar dan gunakan akun lain
              </a>
            </>
          )}
        </section>
      </main>
    );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark">e</div>
          <div>
            <b>e Kinerja</b>
            <span>Kinerja Pegawai</span>
          </div>
        </div>
        <nav aria-label="Navigasi utama">
          <p>MENU UTAMA</p>
          {nav.map(([icon, label]) => (
            <button
              key={label}
              className={active === label ? "nav-item active" : "nav-item"}
              onClick={() => {
                setActive(label);
                notify(`${label} dibuka`);
              }}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {label === "To-Do & Progres" && summary.activeTodoCount > 0 && (
                <i>{summary.activeTodoCount}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="role-card">
          <span>AKSES SAAT INI</span>
          <b>{isSystemOwner ? "Super User" : currentRole.replace("_", " ")}</b>
          <small>
            {isSystemOwner
              ? "Pemilik sistem · di luar Data Pegawai"
              : "Akses mengikuti data pegawai"}
          </small>
        </div>
        <div className="profile" style={{ position: "relative" }}>
          <div className="avatar">
            {currentName
              .split(" ")
              .slice(0, 2)
              .map((x) => x[0])
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <b>{currentName}</b>
            <span>
              {isSystemOwner
                ? "Super User · Pemilik Sistem"
                : currentRole.replace("_", " ")}
            </span>
          </div>
          <button
            aria-label="Menu profil"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setProfileMenuOpen(false), 150)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8, fontSize: 18, color: "var(--text-muted, #888)", lineHeight: 1 }}
          >•••</button>
          {profileMenuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                right: 0,
                minWidth: 180,
                background: "var(--surface, #fff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 12,
                boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
                zIndex: 200,
                padding: "6px 0",
                overflow: "hidden",
              }}
            >
              <a
                href="/api/auth/logout"
                role="menuitem"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  color: "var(--error, #e53e3e)",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover, #fef2f2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Keluar
              </a>
            </div>
          )}
        </div>
      </aside>
      <section className="workspace">
        <header>
          <b className="mobile-brand">e Kinerja</b>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label={`${summary.notificationCount} notifikasi To-Do aktif`}
              onClick={() => setActive("To-Do & Progres")}
            >
              <Icon name="bell" />
              {summary.notificationCount > 0 && (
                <em>{summary.notificationCount}</em>
              )}
            </button>
            <div className="header-date">
              <span>Hari ini</span>
              <b>
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Jakarta",
                })}
              </b>
            </div>
          </div>
        </header>
        <div className="content">
          {active === "Setting Absensi" ? (
            <AttendanceSettings />
          ) : active === "Keamanan Sistem" ? (
            <SecurityCenter />
          ) : active === "Struktur Organisasi" ? (
            <OrganizationSettings />
          ) : active === "Monitoring" ? (
            <MonitoringCenter />
          ) : active === "Absensi" ? (
            <AttendanceCenter />
          ) : active === "To-Do & Progres" ? (
            <RecurringTaskManager />
          ) : active === "Agenda Kegiatan" ? (
            <AgendaCenter />
          ) : active === "Perjanjian Kinerja" ? (
            <PerformanceAgreementCenter />
          ) : active === "Laporan Absensi" ? (
            <MonthlyAttendanceReport />
          ) : (
            <>
              {active === "Data Pegawai" ? (
                <section className="employee-page">
                  <div className="page-title">
                    <div>
                      <p>MASTER DATA</p>
                      <h1>Data Pegawai</h1>
                      <span>
                        Unit/Subbagian hingga Level Akses dikelola khusus Super
                        Admin.
                      </span>
                    </div>
                    <button className="primary" onClick={() => openEmployee()}>
                      <Icon name="plus" /> Tambah Pegawai
                    </button>
                  </div>
                  <div className="employee-summary">
                    <strong>{employees.length}</strong>
                    <span>Total data pegawai</span>
                  </div>
                  <div className="employee-table-wrap">
                    <table className="employee-table">
                      <thead>
                        <tr>
                          <th>Nama Lengkap</th>
                          <th>NIP/NIK</th>
                          <th>Email</th>
                          <th>Nomor HP</th>
                          <th>Jabatan</th>
                          <th>Unit/Subbagian</th>
                          <th>Atasan Langsung</th>
                          <th>Status Pegawai</th>
                          <th>Status Akun</th>
                          <th>Level Akses</th>
                          <th>Izin Tambahan</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.length ? (
                          employees.map((employee) => (
                            <tr key={employee.id}>
                              <td>
                                <b>{employee.fullName}</b>
                              </td>
                              <td>{employee.employeeNumber}</td>
                              <td>{employee.email}</td>
                              <td>{employee.phone}</td>
                              <td>{employee.position || "—"}</td>
                              <td>{employee.unitSubsection || "—"}</td>
                              <td>
                                {employees.find(
                                  (e) => e.id === employee.directSupervisorId,
                                )?.fullName || "—"}
                              </td>
                              <td>
                                <span className="status-badge">
                                  {employee.employeeStatus}
                                </span>
                              </td>
                              <td>
                                <span className="status-badge">
                                  {employee.accountStatus}
                                </span>
                              </td>
                              <td>
                                <span className="access-badge">
                                  {employee.accessLevel}
                                </span>
                              </td>
                              <td>{[employee.operatorAttendance&&"Operator Absensi",employee.operatorSakip&&"Operator SAKIP"].filter(Boolean).join(" · ")||"—"}</td>
                              <td>
                                {canEditEmployees?<div className="row-actions">
                                  <button
                                    onClick={() => openEmployee(employee)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="danger"
                                    onClick={() => deleteEmployee(employee)}
                                  >
                                    Nonaktifkan
                                  </button>
                                </div>:<span className="field-help">Lihat saja</span>}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={12} className="empty-state">
                              Belum ada data pegawai. Klik “Tambah Pegawai”
                              untuk memulai.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : active === "Rule Absensi" ? (
                <section className="rule-page">
                  <div className="page-title">
                    <div>
                      <p>KHUSUS SUPER ADMIN</p>
                      <h1>Rule Absensi</h1>
                      <span>
                        Atur jadwal kerja, batas masuk 08.30, penggantian menit,
                        dan hari libur tambahan.
                      </span>
                    </div>
                    <button
                      className="primary"
                      onClick={saveRules}
                      disabled={saving}
                    >
                      {saving ? "Menyimpan..." : "Simpan Rule"}
                    </button>
                  </div>
                  <div className="rule-grid">
                    <section className="rule-card">
                      <div className="rule-card-head">
                        <b>Jadwal Kerja</b>
                        <span>Sabtu dan Minggu otomatis libur</span>
                      </div>
                      <div className="rule-fields">
                        <label>
                          Senin–Kamis · Jam Masuk
                          <input
                            type="time"
                            value={ruleForm.mondayThursdayStart}
                            onChange={(e) =>
                              setRuleForm({
                                ...ruleForm,
                                mondayThursdayStart: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Senin–Kamis · Jam Pulang
                          <input
                            type="time"
                            value={ruleForm.mondayThursdayEnd}
                            onChange={(e) =>
                              setRuleForm({
                                ...ruleForm,
                                mondayThursdayEnd: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Jumat · Jam Masuk
                          <input
                            type="time"
                            value={ruleForm.fridayStart}
                            onChange={(e) =>
                              setRuleForm({
                                ...ruleForm,
                                fridayStart: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Jumat · Jam Pulang
                          <input
                            type="time"
                            value={ruleForm.fridayEnd}
                            onChange={(e) =>
                              setRuleForm({
                                ...ruleForm,
                                fridayEnd: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    </section>
                    <section className="rule-card">
                      <div className="rule-card-head">
                        <b>Keterlambatan & Batas Masuk</b>
                        <span>Penggantian selalu 1 menit : 1 menit</span>
                      </div>
                      <div className="rule-fields">
                        <label>
                          Batas masuk terakhir
                          <input
                            type="time"
                            value={ruleForm.morningCutoff}
                            onChange={(e) =>
                              setRuleForm({
                                ...ruleForm,
                                morningCutoff: e.target.value,
                              })
                            }
                          />
                        </label>
                        <div className="fixed-rule">
                          <b>Penggantian 1 : 1</b>
                          <span>
                            Setiap menit setelah 07.30 diganti setelah jam
                            pulang kerja.
                          </span>
                        </div>
                        <div className="rule-example">
                          <b>Contoh</b>
                          <span>
                            Masuk 07.45 = terlambat 15 menit. Pulang Senin–Kamis
                            menjadi 16.15.
                          </span>
                        </div>
                        <div className="rule-warning">
                          <b>Setelah {ruleForm.morningCutoff}</b>
                          <span>
                            Absen tetap tercatat, tetapi status pegawai menjadi
                            Tidak Masuk Kerja.
                          </span>
                        </div>
                      </div>
                    </section>
                  </div>
                  <section className="holiday-manager">
                    <div className="rule-card-head">
                      <b>Hari Libur Tambahan</b>
                      <span>
                        Otomatis menjadi pengumuman dan dikeluarkan dari rekap
                        reguler
                      </span>
                    </div>
                    <div className="holiday-form">
                      <label>
                        Tanggal
                        <input
                          type="date"
                          value={holidayForm.date}
                          onChange={(e) =>
                            setHolidayForm({
                              ...holidayForm,
                              date: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Nama Hari Libur
                        <input
                          value={holidayForm.title}
                          placeholder="Contoh: Cuti Bersama"
                          onChange={(e) =>
                            setHolidayForm({
                              ...holidayForm,
                              title: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Keterangan (opsional)
                        <input
                          value={holidayForm.description}
                          placeholder="Keterangan pengumuman"
                          onChange={(e) =>
                            setHolidayForm({
                              ...holidayForm,
                              description: e.target.value,
                            })
                          }
                        />
                      </label>
                      <button
                        className="primary"
                        onClick={addHoliday}
                        disabled={saving}
                      >
                        <Icon name="plus" /> Tambah
                      </button>
                    </div>
                    <div className="holiday-list">
                      {holidays.length ? (
                        holidays.map((holiday) => (
                          <article key={holiday.id}>
                            <div className="holiday-date">
                              <b>
                                {new Date(
                                  `${holiday.holidayDate}T00:00:00`,
                                ).toLocaleDateString("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </b>
                              <span>{holiday.holidayDate.slice(0, 4)}</span>
                            </div>
                            <div>
                              <b>{holiday.title}</b>
                              <span>
                                {holiday.description ||
                                  "Tanpa keterangan tambahan"}
                              </span>
                            </div>
                            <button onClick={() => deleteHoliday(holiday)}>
                              Hapus
                            </button>
                          </article>
                        ))
                      ) : (
                        <div className="empty-state">
                          Belum ada hari libur tambahan.
                        </div>
                      )}
                    </div>
                  </section>
                </section>
              ) : (
                <>
                  {announcement && (
                    <section className="announcement">
                      <div>
                        <b>PENGUMUMAN</b>
                        <strong>{announcement.title}</strong>
                        <span>
                          {announcement.date}
                          {announcement.description
                            ? ` · ${announcement.description}`
                            : ""}
                        </span>
                      </div>
                      <button
                        aria-label="Tutup pengumuman"
                        onClick={() => setAnnouncement(null)}
                      >
                        ×
                      </button>
                    </section>
                  )}
                  <div className="welcome">
                    <div>
                      <p>SELAMAT DATANG KEMBALI</p>
                      <h1>Halo, {currentName} 👋</h1>
                      <h2>
                        {isSystemOwner
                          ? "Kelola sistem dan pantau kinerja organisasi."
                          : "Pantau pekerjaan dan catat kinerja hari ini."}
                      </h2>
                    </div>
                  </div>
                  {day.isHoliday && (
                    <section className="holiday-notice">
                      <b>Hari Libur</b>
                      <span>
                        {day.holidayName}. Absensi tetap tercatat tetapi hanya
                        tampil pada Rekap Hari Libur.
                      </span>
                    </section>
                  )}
                  <section className="attendance-card">
                    <div className="attendance-main">
                      <div className="attendance-icon">
                        <Icon name="clock" />
                      </div>
                      <div>
                        <span>STATUS ABSENSI HARI INI</span>
                        <h3>
                          {activeOtherAttendance
                            ? activeOtherAttendance.type === "DL"
                              ? "Sedang Dinas Luar"
                              : "Sedang Cuti"
                            : attendance?.attendanceStatus === "absent_late"
                              ? "Tidak Masuk Kerja"
                              : attendance?.checkOut
                                ? "Absensi Hari Ini Lengkap"
                                : clockedIn
                                  ? "Sudah Absen Masuk"
                                  : "Belum Absen Masuk"}
                        </h3>
                        <p>
                          {activeOtherAttendance
                            ? `${activeOtherAttendance.type} tercatat ${activeOtherAttendance.startDate}–${activeOtherAttendance.endDate} (${activeOtherAttendance.durationDays} hari)`
                            : clockedIn
                              ? attendance?.attendanceStatus === "late"
                                ? `Terlambat ${attendance.lateMinutes} menit · Ganti ${attendance.replacementMinutes} menit setelah jam pulang`
                                : attendance?.attendanceStatus === "absent_late"
                                  ? `Absen melewati batas ${schedule.attendanceCutoff} · Timestamp tetap tercatat`
                                  : "Absensi tersimpan · Kantor Utama"
                              : !schedule.canCheckIn
                                ? `Absen Masuk tersedia ${schedule.checkInOpenTime}–${schedule.checkInCloseTime} WIB`
                                : `Jam kerja ${schedule.start}–${schedule.end} WIB · batas masuk ${schedule.attendanceCutoff}`}
                        </p>
                      </div>
                    </div>
                    <div className="clock-now">
                      <strong>
                        {new Date().toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Jakarta",
                        })}
                      </strong>
                      <span>WIB</span>
                    </div>
                    <div className="dashboard-attendance-link">
                      <b>
                        {activeOtherAttendance
                          ? activeOtherAttendance.type
                          : attendance?.checkOut
                            ? "Lengkap"
                            : clockedIn
                              ? "Menunggu Absen Pulang"
                              : "Perlu Absen Masuk"}
                      </b>
                      <span>
                        {activeOtherAttendance
                          ? `${activeOtherAttendance.startDate}–${activeOtherAttendance.endDate}`
                          : "Lakukan aktivitas melalui menu Absensi"}
                      </span>
                      <button onClick={() => setActive("Absensi")}>
                        Buka Absensi
                      </button>
                    </div>
                  </section>
                  <AgendaToday open={() => setActive("Agenda Kegiatan")} />
                  <section className="metrics">
                    <article>
                      <div className="metric-icon green">
                        <Icon name="check" />
                      </div>
                      <div>
                        <span>Tugas Selesai</span>
                        <strong>{summary.completedCount}</strong>
                        <small>Data To-Do aktual</small>
                      </div>
                    </article>
                    <article>
                      <div className="metric-icon blue">
                        <Icon name="chart" />
                      </div>
                      <div>
                        <span>Rata-rata Progres</span>
                        <strong>{summary.averageProgress}%</strong>
                        <small>{summary.activeTodoCount} pekerjaan aktif</small>
                      </div>
                    </article>
                    <article>
                      <div className="metric-icon amber">
                        <Icon name="clock" />
                      </div>
                      <div>
                        <span>Perlu Perhatian</span>
                        <strong>{summary.attentionCount}</strong>
                        <small>Urgent atau melewati tenggat</small>
                      </div>
                    </article>
                    <article>
                      <div className="metric-icon violet">
                        <Icon name="users" />
                      </div>
                      <div>
                        <span>Kehadiran Bulan Ini</span>
                        <strong>96%</strong>
                        <small>
                          <b>21</b> dari 22 hari
                        </small>
                      </div>
                    </article>
                  </section>
                  <section className="dashboard-pk-card">
                    <div>
                      <span>PERJANJIAN KINERJA</span>
                      <b>{summary.pkCount} dokumen dalam kewenangan</b>
                      <small>
                        {summary.pkPending} menunggu persetujuan · progres
                        indikator {summary.pkProgress}%
                      </small>
                    </div>
                    <div className="progress">
                      <i style={{ width: `${summary.pkProgress}%` }} />
                    </div>
                    <button onClick={() => setActive("Perjanjian Kinerja")}>
                      Buka PK & RKT
                    </button>
                  </section>
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h3>Progres Pekerjaan Saya</h3>
                        <p>Pekerjaan aktif yang perlu diselesaikan</p>
                      </div>
                      <button onClick={() => notify("Semua tugas ditampilkan")}>
                        Lihat Semua <Icon name="arrow" />
                      </button>
                    </div>
                    <div>
                      {tasks.length ? (
                        tasks.map((task, idx) => (
                          <article className="task" key={task.id}>
                            <div className={`task-index c${idx}`}>
                              {idx + 1}
                            </div>
                            <div className="task-info">
                              <div className="task-title">
                                <b>{task.title}</b>
                                <span>{task.status}</span>
                              </div>
                              <p>
                                {task.unit} · Tenggat {task.due}
                              </p>
                              <div className="progress-row">
                                <div className="progress">
                                  <i style={{ width: `${task.progress}%` }} />
                                </div>
                                <strong>{task.progress}%</strong>
                                {currentRole!=="viewer"&&<button onClick={() => openProgress(task)}>
                                  Update Progress
                                </button>}
                              </div>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="empty-state">
                          Belum ada To-Do aktif.
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </section>
      {showEmployee && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowEmployee(false)}
        >
          <div
            className="modal employee-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span>MASTER DATA PEGAWAI</span>
            <h3>{editingEmployee ? "Edit Data Pegawai" : "Tambah Pegawai"}</h3>
            <p>Lengkapi data dasar dan pengaturan khusus Super Admin.</p>
            <div className="employee-form">
              <label>
                Nama lengkap
                <input
                  value={employeeForm.fullName}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      fullName: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                NIP/NIK pegawai
                <input
                  value={employeeForm.employeeNumber}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      employeeNumber: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, email: e.target.value })
                  }
                />
              </label>
              <label>
                Nomor HP
                <input
                  value={employeeForm.phone}
                  onChange={(e) =>
                    setEmployeeForm({ ...employeeForm, phone: e.target.value })
                  }
                />
              </label>
              <div className="superadmin-fields">
                <b>PENEMPATAN DARI POHON ORGANISASI</b>
                <label>
                  Posisi organisasi
                  <select
                    value={employeeForm.organizationPositionId || ""}
                    onChange={(e) => {const selected=employeePositions.find(position=>position.id===Number(e.target.value));const defaults:Record<string,Employee["accessLevel"]>={Ketua:"Viewer",Anggota:"Viewer",Sekretaris:"Admin",Kasubag:"Editor",Staf:"User"};setEmployeeForm({...employeeForm,organizationPositionId:e.target.value?Number(e.target.value):null,accessLevel:selected?defaults[selected.level]||"User":"User"})}}
                  >
                    <option value="">Pilih posisi yang tersedia</option>
                    {employeePositions.filter(position=>position.status==="Aktif"&&(!position.assignedEmployeeId||position.assignedEmployeeId===editingEmployee?.id)).map((position) => (
                      <option key={position.id} value={position.id}>{position.name} · {position.unitName}</option>
                    ))}
                  </select>
                </label>
                <p className="wide">Jabatan, Unit/Subbagian, atasan langsung, dan akses awal diturunkan otomatis dari posisi ini.</p>
                <label>
                  Status Pegawai
                  <select
                    value={employeeForm.employeeStatus}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        employeeStatus: e.target
                          .value as Employee["employeeStatus"],
                      })
                    }
                  >
                    <option>Aktif</option>
                    <option>Nonaktif</option>
                  </select>
                </label>
                <label>
                  Status Akun
                  <select
                    value={employeeForm.accountStatus}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        accountStatus: e.target
                          .value as Employee["accountStatus"],
                      })
                    }
                  >
                    <option>Aktif</option>
                    <option>Dinonaktifkan</option>
                  </select>
                </label>
                <label>
                  Level Akses
                  <select
                    value={employeeForm.accessLevel}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        accessLevel: e.target.value as Employee["accessLevel"],
                      })
                    }
                  >
                    <option>Super Admin</option>
                    <option>Admin</option>
                    <option>Editor</option>
                    <option>User</option>
                    <option>Viewer</option>
                  </select>
                </label>
                <fieldset className="wide"><legend>Izin tambahan</legend><label className="check-row"><input type="checkbox" checked={employeeForm.operatorAttendance} onChange={e=>setEmployeeForm({...employeeForm,operatorAttendance:e.target.checked})}/> Operator Absensi — mencetak laporan seluruh pegawai</label><label className="check-row"><input type="checkbox" checked={employeeForm.operatorSakip} onChange={e=>setEmployeeForm({...employeeForm,operatorSakip:e.target.checked})}/> Operator SAKIP — mengelola RKT, PK, cascading, Monev, bukti dukung, revisi, dan cetak</label><small>Izin tambahan tidak mengubah pemilik maupun penandatangan dokumen.</small></fieldset>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowEmployee(false)}>Batal</button>
              <button
                className="primary"
                onClick={saveEmployee}
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "Simpan Pegawai"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCheckout && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowCheckout(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span>ABSEN PULANG</span>
            <h3>Output Pekerjaan Hari Ini</h3>
            <p>
              Ringkas hasil pekerjaan yang telah diselesaikan sebelum mencatat
              jam pulang.
            </p>
            <label>
              Output pekerjaan
              <textarea
                autoFocus
                value={workOutput}
                onChange={(e) => setWorkOutput(e.target.value)}
                placeholder="Contoh: Menyelesaikan rekap kegiatan dan mengirimkan bahan verifikasi."
                rows={5}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setShowCheckout(false)}>Batal</button>
              <button className="primary" onClick={checkOut} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan & Absen Pulang"}
              </button>
            </div>
          </div>
        </div>
      )}
      {progressTask && (
        <div className="modal-backdrop" onMouseDown={() => setProgressTask(null)}>
          <div className="modal progress-update-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <span>UPDATE PROGRESS TO-DO</span>
            <h3>{progressTask.title}</h3>
            <p>Catat perkembangan aktual pekerjaan. Progress 100% akan dikirim kepada atasan untuk diperiksa.</p>
            <div className="module-form two-col">
              <label>Progress (%)<input type="number" min="0" max="100" value={progressForm.progress} onChange={(e)=>setProgressForm({...progressForm,progress:Math.max(0,Math.min(100,Number(e.target.value)))})}/></label>
              <label>Status sistem<input value={progressForm.progress===100?"Verifikasi Final":"Dikerjakan"} disabled/></label>
              <label className="wide">Kegiatan yang sudah dilaksanakan<textarea rows={3} value={progressForm.completedActivities} onChange={(e)=>setProgressForm({...progressForm,completedActivities:e.target.value})} placeholder="Jelaskan pekerjaan yang sudah dilakukan pada pembaruan ini"/></label>
              <label className="wide">Realisasi output<textarea rows={3} value={progressForm.outputRealization} onChange={(e)=>setProgressForm({...progressForm,outputRealization:e.target.value})} placeholder="Hasil atau output yang telah tersedia"/></label>
              <label className="wide">Kendala<textarea rows={2} value={progressForm.obstacles} onChange={(e)=>setProgressForm({...progressForm,obstacles:e.target.value})} placeholder="Kosongkan jika tidak ada kendala"/></label>
              <label className="wide">Catatan tambahan<textarea rows={2} value={progressForm.notes} onChange={(e)=>setProgressForm({...progressForm,notes:e.target.value})}/></label>
            </div>
            {progressHistory.length>0&&<div className="progress-history"><h4>Riwayat Pembaruan</h4>{progressHistory.slice(0,5).map(row=><article key={row.id}><b>{row.progress}%</b><div><strong>{row.completedActivities}</strong><small>{row.employeeEmail} · {new Date(row.createdAt+"Z").toLocaleString("id-ID")}</small>{row.obstacles&&<small>Kendala: {row.obstacles}</small>}</div></article>)}</div>}
            <div className="modal-actions"><button onClick={()=>setProgressTask(null)}>Batal</button><button className="primary" onClick={saveProgress} disabled={saving}>{saving?"Menyimpan...":"Simpan Progress"}</button></div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
    </main>
  );
}
