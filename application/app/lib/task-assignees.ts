import { getDb } from "../../db";
import { employees, organizationCoordinations } from "../../db/schema";
import type { requireAuthorizedUser } from "./access";
import { hasSakipOperator } from "./access";

type User = Awaited<ReturnType<typeof requireAuthorizedUser>>;

export async function allowedTaskAssignees(user: User) {
  const active = (await getDb().select().from(employees)).filter(employee => employee.employeeStatus === "Aktif" && employee.accountStatus === "Aktif" && Boolean(employee.email));
  if (user.role === "super_user" || user.role === "super_admin" || hasSakipOperator(user)) return active;
  if (!user.isEmployee) return [];
  const coordination = await getDb().select().from(organizationCoordinations);
  const coordinatedUnits = coordination
    .filter(link => link.commissionerEmployeeId === user.employee.id)
    .map(link => link.unitSubsection);
  if (coordinatedUnits.length) {
    return active.filter(employee => employee.id === user.employee.id || coordinatedUnits.includes(employee.unitSubsection));
  }
  const allowedIds = new Set<number>([user.employee.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const employee of active) {
      if (employee.directSupervisorId && allowedIds.has(employee.directSupervisorId) && !allowedIds.has(employee.id)) {
        allowedIds.add(employee.id);
        changed = true;
      }
    }
  }
  return active.filter(employee => allowedIds.has(employee.id));
}
