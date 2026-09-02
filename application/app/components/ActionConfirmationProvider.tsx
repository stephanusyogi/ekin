"use client";

import { useEffect, useRef, useState } from "react";

type Confirmation = {
  action: string;
  destructive: boolean;
  resolve: (confirmed: boolean) => void;
};

const mutationMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function cleanLabel(value: string) {
  return value.replace(/\s+/g, " ").replace(/^[＋+✓×]\s*/, "").trim();
}

function fallbackAction(url: string, method: string) {
  const path = url.split("?")[0];
  if (path.includes("/attendance/reopen")) return method === "PATCH" ? "menyimpan keputusan pembukaan absensi" : "mengajukan pembukaan absensi";
  if (path.endsWith("/attendance")) return "mencatat absensi";
  if (path.includes("/attendance/other")) return "menyimpan Dinas Luar atau Cuti";
  if (path.includes("/tasks") || path.includes("/recurring-tasks")) return method === "DELETE" ? "menghapus To Do" : "menyimpan perubahan To Do";
  if (path.includes("/employees")) return method === "DELETE" ? "menonaktifkan pegawai" : "menyimpan data pegawai";
  if (path.includes("/agendas")) return method === "DELETE" ? "menghapus agenda" : "menyimpan agenda kegiatan";
  if (path.includes("/holidays")) return method === "DELETE" ? "menghapus hari libur" : "menyimpan hari libur";
  if (path.includes("/attendance-settings")) return "menyimpan pengaturan absensi";
  if (path.includes("/organization")) return method === "DELETE" ? "menghapus data struktur atau koordinasi" : "menyimpan struktur organisasi";
  if (path.includes("/performance" ) || path.includes("/work-plans")) return method === "DELETE" ? "menghapus data kinerja" : "menyimpan data kinerja";
  if (path.includes("/admin/security")) return "mencabut sesi pengguna";
  if (path.includes("/session")) return "mengambil alih sesi akun";
  return method === "DELETE" ? "menghapus data" : "menyimpan perubahan data";
}

export default function ActionConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const lastAction = useRef({ label: "", destructive: false, at: 0 });

  useEffect(() => {
    const rememberAction = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button || button.disabled) return;
      const label = cleanLabel(button.innerText || button.getAttribute("aria-label") || "");
      lastAction.current = {
        label,
        destructive: button.classList.contains("danger") || /hapus|tolak|nonaktif|cabut|batalkan/i.test(label),
        at: Date.now(),
      };
    };
    const rememberSelection = (event: Event) => {
      const control = event.target as HTMLSelectElement | null;
      if (!(control instanceof HTMLSelectElement)) return;
      lastAction.current = {
        label: `mengubah pilihan menjadi ${control.selectedOptions[0]?.text || control.value}`,
        destructive: /nonaktif|dihapus|hapus|batal/i.test(control.value),
        at: Date.now(),
      };
    };
    document.addEventListener("click", rememberAction, true);
    document.addEventListener("change", rememberSelection, true);

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (!mutationMethods.has(method)) return nativeFetch(input, init);
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isSessionCheck = url.split("?")[0].endsWith("/api/session") && !url.includes("takeover=1");
      const bypass = new Headers(init?.headers).get("x-ekinerja-skip-confirmation") === "1";
      if (isSessionCheck || bypass) return nativeFetch(input, init);

      const recent = Date.now() - lastAction.current.at < 60_000 ? lastAction.current : null;
      const action = recent?.label || fallbackAction(url, method);
      const destructive = method === "DELETE" || Boolean(recent?.destructive);
      const confirmed = await new Promise<boolean>((resolve) => setConfirmation({ action, destructive, resolve }));
      if (!confirmed) {
        return new Response(JSON.stringify({ error: "Tindakan dibatalkan oleh pengguna" }), {
          status: 409,
          headers: { "content-type": "application/json" },
        });
      }
      return nativeFetch(input, init);
    };
    return () => {
      document.removeEventListener("click", rememberAction, true);
      document.removeEventListener("change", rememberSelection, true);
      window.fetch = nativeFetch;
    };
  }, []);

  const finish = (confirmed: boolean) => {
    confirmation?.resolve(confirmed);
    setConfirmation(null);
  };

  useEffect(() => {
    if (!confirmation) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") finish(false); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [confirmation]);

  return <>
    {children}
    {confirmation && <div className="action-confirm-backdrop" role="presentation" onMouseDown={() => finish(false)}>
      <section className={`action-confirm-dialog ${confirmation.destructive ? "destructive" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby="action-confirm-title" aria-describedby="action-confirm-description" onMouseDown={(event) => event.stopPropagation()}>
        <div className="action-confirm-icon" aria-hidden="true">{confirmation.destructive ? "!" : "✓"}</div>
        <span>KONFIRMASI TINDAKAN</span>
        <h2 id="action-confirm-title">Apakah tindakan ini benar?</h2>
        <p id="action-confirm-description">Anda akan <b>{confirmation.action.toLowerCase()}</b>. Pastikan data dan pilihan sudah benar karena tindakan akan diproses menggunakan akun Anda.</p>
        <div className="action-confirm-actions">
          <button autoFocus onClick={() => finish(false)}>Batal</button>
          <button className={confirmation.destructive ? "danger" : "primary"} onClick={() => finish(true)}>{confirmation.destructive ? "Ya, lanjutkan" : "Ya, saya yakin"}</button>
        </div>
      </section>
    </div>}
  </>;
}
