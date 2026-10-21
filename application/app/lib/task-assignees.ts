import { getDb } from "../../db";
import { employees, organizationCoordinations } from "../../db/schema";
import type { requireAuthorizedUser } from "./access";
import { hasSakipOperator } from "./access";

type User = Awaited<ReturnType<typeof requireAuthorizedUser>>;

export function isLeadershipOrSupervisor(position?: string | null): boolean {
  if (!position) return false;
  const p = position.trim().toLowerCase();
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

export async function allowedTaskAssignees(user: User) {
  const active = (await getDb().select().from(employees)).filter(
    employee => employee.employeeStatus === "Aktif" && employee.accountStatus === "Aktif" && Boolean(employee.email)
  );

  // Staf pelaksana operasional saja — Komisioner, Sekretaris, dan Kasubag tidak dimasukkan sebagai PIC To-Do
  const operationalStaff = active.filter(employee => !isLeadershipOrSupervisor(employee.position));

  if (user.role === "super_user" || user.role === "super_admin" || hasSakipOperator(user)) {
    return operationalStaff;
  }
  if (!user.isEmployee) return [];

  const coordination = await getDb().select().from(organizationCoordinations);
  const coordinatedUnits = coordination
    .filter(link => link.commissionerEmployeeId === user.employee.id)
    .map(link => link.unitSubsection);
  if (coordinatedUnits.length) {
    return operationalStaff.filter(employee => coordinatedUnits.includes(employee.unitSubsection));
  }

  const allowedIds = new Set<number>();

  // Jika user pembuat adalah staf pelaksana, sertakan diri sendiri
  if (!isLeadershipOrSupervisor(user.employee.position)) {
    allowedIds.add(user.employee.id);
  }

  // Cari bawahan langsung/turunannya yang merupakan staf pelaksana
  const supervisorTree = new Set<number>([user.employee.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const employee of active) {
      if (employee.directSupervisorId && supervisorTree.has(employee.directSupervisorId)) {
        if (!supervisorTree.has(employee.id)) {
          supervisorTree.add(employee.id);
          changed = true;
        }
        if (!isLeadershipOrSupervisor(employee.position)) {
          allowedIds.add(employee.id);
        }
      }
    }
  }

  // Fallback subbagian: seluruh staf pelaksana dalam subbagian yang sama (garis koordinasi subbag)
  const userUnit = user.employee?.unitSubsection;
  if (userUnit) {
    for (const employee of operationalStaff) {
      if (employee.unitSubsection === userUnit) {
        allowedIds.add(employee.id);
      }
    }
  }

  return operationalStaff.filter(employee => allowedIds.has(employee.id));
}
