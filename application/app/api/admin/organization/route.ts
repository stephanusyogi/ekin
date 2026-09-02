import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { employees, organizationCoordinations, organizationPositions, organizationUnits } from "../../../../db/schema";
import { requireSuperAdmin } from "../../../lib/access";
import { positionOptions, syncEmployeePlacements } from "../../../lib/organization";

type OrganizationInput = {
  kind?: "unit" | "position" | "coordination"; id?: number; name?: string; type?: string;
  parentId?: number | null; sortOrder?: number; status?: "Aktif" | "Nonaktif";
  level?: "Ketua" | "Anggota" | "Sekretaris" | "Kasubag" | "Staf"; unitId?: number;
  reportsToPositionId?: number | null; commissionerEmployeeId?: number; unitSubsection?: string;
};

export async function GET(request: Request) {
  try { await requireSuperAdmin(request); const db = getDb(); return Response.json({ employees: await db.select().from(employees).orderBy(asc(employees.fullName)), coordinations: await db.select().from(organizationCoordinations).orderBy(asc(organizationCoordinations.unitSubsection)), units: await db.select().from(organizationUnits).orderBy(asc(organizationUnits.sortOrder), asc(organizationUnits.name)), positions: await positionOptions() }); }
  catch { return Response.json({ error: "Akses Super User/Super Admin diperlukan" }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin(request); const input = await request.json() as OrganizationInput, db = getDb();
    if (input.kind === "unit") {
      const name = input.name?.trim(); if (!name) return Response.json({ error: "Nama struktur wajib diisi" }, { status: 400 });
      if (input.parentId) { const [parent] = await db.select().from(organizationUnits).where(eq(organizationUnits.id, input.parentId)).limit(1); if (!parent) return Response.json({ error: "Parent tidak ditemukan" }, { status: 400 }); }
      const [res] = await db.insert(organizationUnits).values({ name, type: input.type?.trim() || "Unit", parentId: input.parentId || null, sortOrder: Number(input.sortOrder || 0), status: input.status || "Aktif" });
      const [unit] = await db.select().from(organizationUnits).where(eq(organizationUnits.id, res.insertId)).limit(1);
      return Response.json({ unit }, { status: 201 });
    }
    if (input.kind === "position") {
      if (!input.name?.trim() || !input.level || !input.unitId) return Response.json({ error: "Nama, tingkat jabatan, dan unit posisi wajib diisi" }, { status: 400 });
      const [unit] = await db.select().from(organizationUnits).where(eq(organizationUnits.id, input.unitId)).limit(1); if (!unit) return Response.json({ error: "Unit posisi tidak ditemukan" }, { status: 400 });
      const [res] = await db.insert(organizationPositions).values({ name: input.name.trim(), level: input.level, unitId: input.unitId, reportsToPositionId: input.reportsToPositionId || null, sortOrder: Number(input.sortOrder || 0), status: input.status || "Aktif" });
      const [position] = await db.select().from(organizationPositions).where(eq(organizationPositions.id, res.insertId)).limit(1);
      return Response.json({ position }, { status: 201 });
    }
    if (!input.commissionerEmployeeId || !input.unitSubsection?.trim()) return Response.json({ error: "Anggota dan Subbag wajib dipilih" }, { status: 400 });
    const [existing] = await db.select().from(organizationCoordinations).where(and(eq(organizationCoordinations.commissionerEmployeeId, input.commissionerEmployeeId), eq(organizationCoordinations.unitSubsection, input.unitSubsection.trim()))).limit(1);
    if (!existing) {
      const [res] = await db.insert(organizationCoordinations).values({ commissionerEmployeeId: input.commissionerEmployeeId, unitSubsection: input.unitSubsection.trim() });
      const [row] = await db.select().from(organizationCoordinations).where(eq(organizationCoordinations.id, res.insertId)).limit(1);
      return Response.json({ coordination: row }, { status: 201 });
    }
    return Response.json({ coordination: existing }, { status: 201 });
  } catch { return Response.json({ error: "Data struktur belum dapat disimpan" }, { status: 403 }); }
}

export async function PATCH(request: Request) {
  try {
    await requireSuperAdmin(request); const input = await request.json() as OrganizationInput, db = getDb(); if (!input.id) return Response.json({ error: "Data struktur tidak ditemukan" }, { status: 400 });
    if (input.kind === "position") {
      if (input.reportsToPositionId === input.id) return Response.json({ error: "Posisi tidak dapat menjadi atasannya sendiri" }, { status: 400 });
      await db.update(organizationPositions).set({ name: input.name?.trim() || "Tanpa Nama", level: input.level || "Staf", unitId: Number(input.unitId), reportsToPositionId: input.reportsToPositionId || null, sortOrder: Number(input.sortOrder || 0), status: input.status || "Aktif", updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(organizationPositions.id, input.id));
      const [position] = await db.select().from(organizationPositions).where(eq(organizationPositions.id, input.id)).limit(1);
      await syncEmployeePlacements(); return Response.json({ position });
    }
    const all = await db.select().from(organizationUnits); if (input.parentId === input.id) return Response.json({ error: "Struktur tidak dapat menjadi parent dirinya sendiri" }, { status: 400 }); let cursor = input.parentId || null; const seen = new Set<number>(); while (cursor) { if (cursor === input.id) return Response.json({ error: "Perubahan parent membentuk siklus struktur" }, { status: 400 }); if (seen.has(cursor)) break; seen.add(cursor); cursor = all.find((row) => row.id === cursor)?.parentId || null; }
    await db.update(organizationUnits).set({ name: input.name?.trim() || "Tanpa Nama", type: input.type?.trim() || "Unit", parentId: input.parentId || null, sortOrder: Number(input.sortOrder || 0), status: input.status || "Aktif", updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(organizationUnits.id, input.id));
    const [unit] = await db.select().from(organizationUnits).where(eq(organizationUnits.id, input.id)).limit(1);
    await syncEmployeePlacements(); return Response.json({ unit });
  } catch { return Response.json({ error: "Struktur belum dapat diperbarui" }, { status: 403 }); }
}

export async function DELETE(request: Request) {
  try { await requireSuperAdmin(request); const url = new URL(request.url), kind = url.searchParams.get("kind") || "coordination", id = Number(url.searchParams.get("id")); if (!id) return Response.json({ error: "Data tidak ditemukan" }, { status: 400 }); if (kind !== "coordination") return Response.json({ error: "Unit dan posisi tidak dihapus permanen. Gunakan status Nonaktif." }, { status: 400 }); await getDb().delete(organizationCoordinations).where(eq(organizationCoordinations.id, id)); return Response.json({ success: true }); }
  catch { return Response.json({ error: "Data belum dapat dihapus" }, { status: 403 }); }
}
