
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./db/schema.ts";

async function main() {
  const connection = await mysql.createConnection({
    uri: "mysql://root:root@127.0.0.1:3307/ekinerja"
  });
  const db = drizzle(connection, { schema, mode: "default" });
  const agreements = await db.select().from(schema.performanceAgreements);
  const staff = await db.select().from(schema.employees);
  const indicators = await db.select().from(schema.performanceIndicators);
  
  console.log("Employees:");
  for (const e of staff) {
    if (e.position.toLowerCase().includes("sdm")) {
      console.log(`- ID: ${e.id}: ${e.fullName} (${e.position}) [Supervisor: ${e.directSupervisorId}]`);
    }
  }

  console.log("\nPKs:");
  for (const a of agreements) {
    const owner = staff.find(x => x.id === a.employeeId);
    if (owner && owner.position.toLowerCase().includes("sdm")) {
      const ind = indicators.filter(i => i.agreementId === a.id);
      console.log(`- PK ${a.id}: Owner ${owner.fullName} (${owner.position}), Status: ${a.status}, Indicators: ${ind.length}`);
    }
  }
  process.exit(0);
}

main().catch(console.error);

