import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { employees, organizationCoordinations, tasks } from "../../db/schema";
import type { requireAuthorizedUser } from "./access";
import { hasSakipOperator } from "./access";

export type TaskRow = typeof tasks.$inferSelect;
export type EmployeeRow = typeof employees.$inferSelect;
export type UserIdentity = Awaited<ReturnType<typeof requireAuthorizedUser>>;

export const parsePics = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "object") {
    const fromPics = raw.picEmails ? parsePics(raw.picEmails) : [];
    if (fromPics.length > 0) return fromPics;
    if (raw.ownerEmail && typeof raw.ownerEmail === "string") return [raw.ownerEmail];
    return [];
  }
  try {
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      if (typeof parsed === "string" && parsed.trim()) return [parsed.trim()];
      return [];
    }
    return [];
  } catch {
    return typeof raw === "string" && raw.trim() ? [raw.trim()] : [];
  }
};

/**
 * Recursively find all subordinate IDs (direct and indirect) for a given employee.
 */
export function getSubordinateEmployeeIds(
  supervisorEmployeeId: number,
  allEmployees: EmployeeRow[],
  supervisorPosition?: string,
  supervisorUnit?: string,
): Set<number> {
  const subordinateIds = new Set<number>();

  let added = true;
  while (added) {
    added = false;
    for (const emp of allEmployees) {
      if (emp.directSupervisorId) {
        if (
          emp.directSupervisorId === supervisorEmployeeId ||
          subordinateIds.has(emp.directSupervisorId)
        ) {
          if (!subordinateIds.has(emp.id)) {
            subordinateIds.add(emp.id);
            added = true;
          }
        }
      }
    }
  }

  // Safety fallback for Kasubag: staff in the same subbagian
  const isKasubag = supervisorPosition?.toLowerCase().includes("kasubag");
  if (isKasubag && supervisorUnit) {
    for (const emp of allEmployees) {
      if (
        emp.id !== supervisorEmployeeId &&
        emp.unitSubsection === supervisorUnit &&
        !emp.position?.toLowerCase().includes("kasubag") &&
        emp.position?.toLowerCase() !== "sekretaris" &&
        emp.position?.toLowerCase() !== "ketua"
      ) {
        subordinateIds.add(emp.id);
      }
    }
  }

  return subordinateIds;
}

export interface TaskAccessScope {
  isTopLevel: boolean;
  subordinateEmails: Set<string>;
  subordinateIds: Set<number>;
  coordinatedUnits: string[];
  isSakipOperator: boolean;
  scopeLabel: string;
}

export async function resolveTaskAccessScope(
  user: UserIdentity,
  allEmployees: EmployeeRow[],
): Promise<TaskAccessScope> {
  const userEmail = user.email.toLowerCase();
  const employee = allEmployees.find(e => e.email?.toLowerCase() === userEmail);
  const role = user.role;
  const isSakip = hasSakipOperator(user);

  // Top-level leaders and administrators oversee all tasks
  const isTopLevel =
    ["super_user", "super_admin", "admin"].includes(role) ||
    employee?.position === "Sekretaris" ||
    employee?.position === "Ketua";

  if (isTopLevel) {
    return {
      isTopLevel: true,
      subordinateEmails: new Set(
        allEmployees.map(e => e.email?.toLowerCase()).filter(Boolean) as string[],
      ),
      subordinateIds: new Set(allEmployees.map(e => e.id)),
      coordinatedUnits: [],
      isSakipOperator: isSakip,
      scopeLabel: "Seluruh lembaga",
    };
  }

  let coordinatedUnits: string[] = [];
  if (employee?.position === "Anggota") {
    const db = getDb();
    const links = await db
      .select()
      .from(organizationCoordinations)
      .where(eq(organizationCoordinations.commissionerEmployeeId, employee.id));
    coordinatedUnits = links.map(x => x.unitSubsection);
  }

  const subordinateIds = employee
    ? getSubordinateEmployeeIds(
        employee.id,
        allEmployees,
        employee.position,
        employee.unitSubsection,
      )
    : new Set<number>();

  const subordinateEmails = new Set<string>();
  for (const emp of allEmployees) {
    if (subordinateIds.has(emp.id) && emp.email) {
      subordinateEmails.add(emp.email.toLowerCase());
    }
  }

  let scopeLabel = "Yang bersangkutan";
  if (coordinatedUnits.length) {
    scopeLabel = "Subbagian dalam garis koordinasi";
  } else if (subordinateEmails.size > 0) {
    scopeLabel = `Bawahan langsung (${subordinateEmails.size} pegawai) & tugas pribadi`;
  }

  return {
    isTopLevel: false,
    subordinateEmails,
    subordinateIds,
    coordinatedUnits,
    isSakipOperator: isSakip,
    scopeLabel,
  };
}

/**
 * Rules:
 * "To Do hanya bisa dilihat yang bersangkutan dan diatasnya."
 * - Yang bersangkutan: Creator, Owner, or assigned PIC.
 * - Diatasnya: Direct/indirect supervisor of Creator, Owner, or assigned PIC.
 * - Top-level: Super User/Admin, Sekretaris, Ketua.
 * - Commissioner: coordinated units.
 * - SAKIP operator: RKT/PK linked tasks.
 */
export function isTaskVisible(
  task: TaskRow,
  userEmail: string,
  scope: TaskAccessScope,
): boolean {
  if (scope.isTopLevel) return true;

  const normalizedUser = userEmail.toLowerCase();
  const pics = parsePics(task.picEmails).map(e => e.toLowerCase());
  const creator = (task.createdBy || "").toLowerCase();
  const owner = (task.ownerEmail || "").toLowerCase();

  // 1. Yang bersangkutan (the person concerned)
  const isConcerned =
    creator === normalizedUser ||
    owner === normalizedUser ||
    pics.includes(normalizedUser);

  if (isConcerned) return true;

  // 2. Diatasnya (superior of any person concerned: creator, owner, or any assigned PIC)
  const isSuperior =
    (Boolean(creator) && scope.subordinateEmails.has(creator)) ||
    (Boolean(owner) && scope.subordinateEmails.has(owner)) ||
    pics.some(pic => scope.subordinateEmails.has(pic));

  if (isSuperior) return true;

  // 3. Commissioner coordination
  if (scope.coordinatedUnits.length > 0 && scope.coordinatedUnits.includes(task.unit)) {
    return true;
  }

  // 4. SAKIP operator (for RKT/PK linked tasks)
  if (scope.isSakipOperator && Boolean(task.sourcePerformanceAgreementId)) {
    return true;
  }

  return false;
}

/**
 * Only superiors of the creator, owner, or assigned PICs (or top-level leadership/admin) can approve or verify.
 */
export function canUserApproveTask(
  task: TaskRow,
  userEmail: string,
  scope: TaskAccessScope,
): boolean {
  if (scope.isTopLevel) return true;

  const pics = parsePics(task.picEmails).map(e => e.toLowerCase());
  const creator = (task.createdBy || "").toLowerCase();
  const owner = (task.ownerEmail || "").toLowerCase();

  return (
    (Boolean(creator) && scope.subordinateEmails.has(creator)) ||
    (Boolean(owner) && scope.subordinateEmails.has(owner)) ||
    pics.some(pic => scope.subordinateEmails.has(pic))
  );
}

/**
 * Enriches a task record with human-readable employee names for all assigned PICs.
 */
export function enrichTaskWithPicNames<T extends TaskRow>(
  task: T,
  allEmployees: EmployeeRow[],
): T & { picNames: string[] } {
  const pics = parsePics(task.picEmails);
  const picNames = pics.map(email => {
    const emp = allEmployees.find(e => e.email?.toLowerCase() === email.toLowerCase());
    return emp?.fullName?.trim() || email;
  });
  return {
    ...task,
    picNames,
  };
}
