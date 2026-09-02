import { asc, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { employees, organizationUnits } from "../../../db/schema";
import { requireAdmin, requireSuperAdmin } from "../../lib/access";
import { placementForPosition, positionOptions } from "../../lib/organization";
import { logSecurityEvent } from "../../lib/security";

type AccessLevel = "Super Admin" | "Admin" | "Editor" | "User" | "Viewer";
type EmployeeInput = { id?: number; fullName?: string; employeeNumber?: string; email?: string; phone?: string; organizationPositionId?: number | null; employeeStatus?: "Aktif" | "Nonaktif"; accountStatus?: "Aktif" | "Dinonaktifkan"; accessLevel?: AccessLevel; operatorAttendance?: boolean; operatorSakip?: boolean };

async function updateLeadership(employeeId: number, unitId: number, level: string) {
  const db = getDb();
  const units = await db.select().from(organizationUnits);
  for (const unit of units.filter((row) => row.leaderEmployeeId === employeeId)) await db.update(organizationUnits).set({ leaderEmployeeId: null, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(organizationUnits.id, unit.id));
  if (["Ketua", "Sekretaris", "Kasubag"].includes(level)) await db.update(organizationUnits).set({ leaderEmployeeId: employeeId, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(organizationUnits.id, unitId));
  if (level === "Ketua") for (const unit of units.filter((row) => row.type === "Komisioner")) await db.update(organizationUnits).set({ leaderEmployeeId: employeeId, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(organizationUnits.id, unit.id));
}

export async function GET(request: Request) {
  try { await requireAdmin(request); const [rows, positions] = await Promise.all([getDb().select().from(employees).orderBy(asc(employees.fullName)).limit(500), positionOptions()]); return Response.json({ employees: rows, positions }); }
  catch { return Response.json({ error: "Akses Admin diperlukan" }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request), input = await request.json() as EmployeeInput, positionId = Number(input.organizationPositionId || 0), base = { fullName: input.fullName?.trim() || "", employeeNumber: input.employeeNumber?.trim() || "", email: input.email?.trim().toLowerCase() || null, phone: input.phone?.trim() || "" };
    if ([base.fullName, base.employeeNumber, base.phone].some((value) => !value) || !positionId) return Response.json({ error: "Nama, NIP/NIK, nomor HP, dan posisi pada Pohon Organisasi wajib diisi" }, { status: 400 });
    const db = getDb(), placement = await placementForPosition(positionId), [occupied] = await db.select().from(employees).where(eq(employees.organizationPositionId, positionId)).limit(1);
    if (occupied) return Response.json({ error: `Posisi sudah ditempati ${occupied.fullName}` }, { status: 409 });
    const isSuper = ["super_user", "super_admin"].includes(admin.role), accessLevel = isSuper && input.accessLevel ? input.accessLevel : placement.defaultAccessLevel;
    const duplicate = await db.select({ id: employees.id }).from(employees).where(base.email ? or(eq(employees.email, base.email), eq(employees.employeeNumber, base.employeeNumber)) : eq(employees.employeeNumber, base.employeeNumber)).limit(1);
    if (duplicate.length) return Response.json({ error: "Email atau NIP/NIK sudah digunakan" }, { status: 409 });
    const [res] = await db.insert(employees).values({ ...base, position: placement.positionName, unitSubsection: placement.unitName, directSupervisorId: placement.directSupervisorId, organizationPositionId: positionId, employeeStatus: input.employeeStatus || "Aktif", accountStatus: input.accountStatus || "Dinonaktifkan", accessLevel, operatorAttendance: Boolean(isSuper && input.operatorAttendance), operatorSakip: Boolean(isSuper && input.operatorSakip) });
    const [employee] = await db.select().from(employees).where(eq(employees.id, res.insertId)).limit(1);
    await updateLeadership(employee.id, placement.unit.id, placement.position.level);
    await logSecurityEvent(request, { actorEmail: admin.email, actorRole: admin.role, action: "CREATE", resourceType: "employee", resourceId: employee.id, after: employee });
    return Response.json({ employee }, { status: 201 });
  } catch { return Response.json({ error: "Data pegawai belum dapat disimpan" }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireSuperAdmin(request), input = await request.json() as EmployeeInput;
    if (!input.id) return Response.json({ error: "Pegawai tidak ditemukan" }, { status: 400 });
    const db = getDb(), [before] = await db.select().from(employees).where(eq(employees.id, input.id)).limit(1);
    if (!before) return Response.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
    const positionId = Number(input.organizationPositionId || 0), placement = await placementForPosition(positionId, input.id), [occupied] = await db.select().from(employees).where(eq(employees.organizationPositionId, positionId)).limit(1);
    if (occupied && occupied.id !== input.id) return Response.json({ error: `Posisi sudah ditempati ${occupied.fullName}` }, { status: 409 });
    const values = { fullName: input.fullName?.trim() || "", employeeNumber: input.employeeNumber?.trim() || "", email: input.email?.trim().toLowerCase() || null, phone: input.phone?.trim() || "", position: placement.positionName, unitSubsection: placement.unitName, directSupervisorId: placement.directSupervisorId, organizationPositionId: positionId, employeeStatus: input.employeeStatus || "Aktif" as const, accountStatus: input.accountStatus || "Dinonaktifkan" as const, accessLevel: input.accessLevel || placement.defaultAccessLevel, operatorAttendance: Boolean(input.operatorAttendance), operatorSakip: Boolean(input.operatorSakip), updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') };
    if ([values.fullName, values.employeeNumber, values.phone].some((value) => !value)) return Response.json({ error: "Nama, NIP/NIK, dan nomor HP wajib diisi" }, { status: 400 });
    await db.update(employees).set(values).where(eq(employees.id, input.id));
    const [employee] = await db.select().from(employees).where(eq(employees.id, input.id)).limit(1);
    await updateLeadership(employee.id, placement.unit.id, placement.position.level);
    await logSecurityEvent(request, { actorEmail: admin.email, actorRole: admin.role, action: "UPDATE", resourceType: "employee", resourceId: input.id, before, after: employee });
    return Response.json({ employee });
  } catch { return Response.json({ error: "Perubahan data pegawai hanya untuk Super User/Super Admin" }, { status: 403 }); }
}

export async function DELETE(request: Request) {
  try { const admin = await requireSuperAdmin(request), url = new URL(request.url), id = Number(url.searchParams.get("id")), reason = (url.searchParams.get("reason") || "").trim(); if (!id) return Response.json({ error: "Pegawai tidak ditemukan" }, { status: 400 }); if (reason.length < 5) return Response.json({ error: "Alasan penonaktifan minimal 5 karakter" }, { status: 400 }); const [before] = await getDb().select().from(employees).where(eq(employees.id, id)).limit(1); if (!before) return Response.json({ error: "Pegawai tidak ditemukan" }, { status: 404 }); await getDb().update(employees).set({ employeeStatus: "Nonaktif", accountStatus: "Dinonaktifkan", updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(employees.id, id)); const [employee] = await getDb().select().from(employees).where(eq(employees.id, id)).limit(1); await logSecurityEvent(request, { actorEmail: admin.email, actorRole: admin.role, action: "SOFT_DELETE", resourceType: "employee", resourceId: id, reason, before, after: employee }); return Response.json({ success: true, employee }); }
  catch { return Response.json({ error: "Data pegawai belum dapat dinonaktifkan" }, { status: 403 }); }
}
