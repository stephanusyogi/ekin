import { requireAuthorizedUser } from "../../lib/access";
import { allowedTaskPerformanceSources } from "../../lib/task-performance-sources";

export async function GET(request: Request) {
  try {
    const user = await requireAuthorizedUser(request);
    return Response.json({ sources: await allowedTaskPerformanceSources(user) });
  } catch {
    return Response.json({ error: "Sumber PK tidak tersedia" }, { status: 403 });
  }
}

