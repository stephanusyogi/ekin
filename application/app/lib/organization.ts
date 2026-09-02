import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { employees, organizationPositions, organizationUnits } from "../../db/schema";

type Level = (typeof organizationPositions.$inferSelect)["level"];
export const defaultAccessForLevel = (level: Level) => ({ Ketua: "Viewer", Anggota: "Viewer", Sekretaris: "Admin", Kasubag: "Editor", Staf: "User" } as const)[level];

export async function organizationData() {
  const db = getDb();
  const [units, positions] = await Promise.all([
    db.select().from(organizationUnits).orderBy(asc(organizationUnits.sortOrder), asc(organizationUnits.name)),
    db.select().from(organizationPositions).orderBy(asc(organizationPositions.sortOrder), asc(organizationPositions.name)),
  ]);
  return { units, positions };
}

export async function placementForPosition(positionId: number, currentEmployeeId?: number) {
  const db = getDb();
  const { units, positions } = await organizationData();
  const position = positions.find((row) => row.id === positionId && row.status === "Aktif");
  if (!position) throw new Error("INVALID_ORGANIZATION_POSITION");
  const unit = units.find((row) => row.id === position.unitId && row.status === "Aktif");
  if (!unit) throw new Error("INVALID_ORGANIZATION_UNIT");
  const supervisorPosition = position.reportsToPositionId ? positions.find((row) => row.id === position.reportsToPositionId) : null;
  const [supervisor] = supervisorPosition ? await db.select().from(employees).where(eq(employees.organizationPositionId, supervisorPosition.id)).limit(1) : [];
  return {
    position,
    unit,
    positionName: position.level,
    unitName: unit.name,
    directSupervisorId: supervisor?.id === currentEmployeeId ? null : supervisor?.id || null,
    defaultAccessLevel: defaultAccessForLevel(position.level),
  };
}

export async function positionOptions() {
  const db = getDb(), { units, positions } = await organizationData(), staff = await db.select().from(employees);
  return positions.map((position) => ({
    ...position,
    unitName: units.find((unit) => unit.id === position.unitId)?.name || "Unit tidak ditemukan",
    assignedEmployeeId: staff.find((employee) => employee.organizationPositionId === position.id)?.id || null,
    assignedEmployeeName: staff.find((employee) => employee.organizationPositionId === position.id)?.fullName || null,
  }));
}

export async function syncEmployeePlacements() {
  const db = getDb(), staff = await db.select().from(employees);
  for (const employee of staff) {
    if (!employee.organizationPositionId) continue;
    const placement = await placementForPosition(employee.organizationPositionId, employee.id);
    await db.update(employees).set({ position: placement.positionName, unitSubsection: placement.unitName, directSupervisorId: placement.directSupervisorId, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(employees.id, employee.id));
  }
}
