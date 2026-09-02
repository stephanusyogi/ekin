import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
import { allowedTaskAssignees } from "../../lib/task-assignees";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { organizationUnits } from "../../../db/schema";

export async function GET(request: Request) {
  const user = await requireAuthorizedUser(request);
  const assignees = (await allowedTaskAssignees(user)).map(employee => ({
    id: employee.id,
    fullName: employee.fullName,
    email: employee.email,
    position: employee.position,
    unit: employee.unitSubsection,
    isSelf: employee.email?.toLowerCase() === user.email,
  }));
  const units=(await getDb().select().from(organizationUnits).where(eq(organizationUnits.status,"Aktif")).orderBy(asc(organizationUnits.sortOrder),asc(organizationUnits.name))).map(unit=>({id:unit.id,name:unit.name,type:unit.type,parentId:unit.parentId}));
  return Response.json({ assignees, units, currentEmail:user.email, canCreate: user.role !== "viewer" || hasSakipOperator(user), canAdministerTasks:["super_user","super_admin"].includes(user.role) });
}
