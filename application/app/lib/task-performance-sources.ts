import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { employees, performanceAgreements, performanceIndicators } from "../../db/schema";
import type { requireAuthorizedUser } from "./access";
import { hasSakipOperator } from "./access";

type User = Awaited<ReturnType<typeof requireAuthorizedUser>>;

export async function allowedTaskPerformanceSources(user: User) {
  const db = getDb();
  const staff = await db.select().from(employees).orderBy(asc(employees.fullName));
  const self = user.isEmployee ? staff.find(employee => employee.id === user.employee.id) : null;
  const approved = await db.select().from(performanceAgreements).where(eq(performanceAgreements.status, "Disetujui")).orderBy(asc(performanceAgreements.year));

  let allowedAgreements = approved;
  if (!["super_user", "super_admin"].includes(user.role) && !hasSakipOperator(user)) {
    if (!self) allowedAgreements = [];
    else {
      const position = self.position.trim().toLocaleLowerCase("id-ID");
      const chairIds = staff.filter(employee => employee.position.trim().toLocaleLowerCase("id-ID").includes("ketua")).map(employee => employee.id);
      let ownerIds: number[] = [];
      if (position.includes("anggota")) ownerIds = chairIds;
      else if (user.role === "admin") ownerIds = [...new Set([self.id, ...chairIds])];
      else if (position.includes("ketua")) ownerIds = [self.id];
      else if (self.directSupervisorId) ownerIds = [self.directSupervisorId];
      allowedAgreements = approved.filter(agreement => ownerIds.includes(agreement.employeeId));
    }
  }

  const agreementIds = allowedAgreements.map(agreement => agreement.id);
  const indicators = agreementIds.length
    ? await db.select().from(performanceIndicators).where(inArray(performanceIndicators.agreementId, agreementIds)).orderBy(asc(performanceIndicators.sortOrder))
    : [];

  return indicators.map(indicator => {
    const agreement = allowedAgreements.find(row => row.id === indicator.agreementId)!;
    const owner = staff.find(employee => employee.id === agreement.employeeId);
    return {
      agreementId: agreement.id,
      indicatorId: indicator.id,
      year: agreement.year,
      agreementTitle: agreement.title,
      agreementLevel: agreement.agreementLevel,
      ownerName: owner?.fullName || "Pemilik PK",
      ownerPosition: owner?.position || agreement.agreementLevel,
      objective: indicator.objective,
      indicator: indicator.indicator,
      target: indicator.targetDisplay || indicator.target,
    };
  });
}
