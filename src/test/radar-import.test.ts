import { describe, expect, it } from "vitest";
import { parseRadarCsv, radarRowsToCleanRecords } from "@/lib/radar-import";

describe("radar import parser", () => {
  it("parses implementation radar csv rows and normalizes stage counts", () => {
    const csv = [
      "Implementation Life Cycle,,,,,,,,,,,,,",
      ",,,,,,,,,,,,,",
      "Implementation Activates,,,,,,,,,,,,,",
      "#,Projects,SDM,Total Activates,1- Planning,2- Analysis,3- Infra,4- Design,5- Development,6- UAT,7- Deployment,8- Training,9- Go-Live,10- Support",
      "1,EPM-IDT Phase 3,Mohamed Ahmed,26,0,0,0,0,0,0,26,0,0,0",
      "2,EPM-Zein EPM III - HR,Rami Mamoon,28,0,0,0,0,9,17,0,2,0,0",
      "Total,,,54,0,0,0,0,9,17,26,2,0,0",
    ].join("\n");

    const rows = parseRadarCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      rank: 1,
      projectName: "EPM-IDT Phase 3",
      ownerName: "Mohamed Ahmed",
      totalActivities: 26,
    });
    expect(rows[0].stageCounts.deployment).toBe(26);
    expect(rows[1].stageCounts.development).toBe(9);
    expect(rows[1].stageCounts.uat).toBe(17);

    expect(radarRowsToCleanRecords(rows)[1]).toMatchObject({
      project_name: "EPM-Zein EPM III - HR",
      owner_name: "Rami Mamoon",
      total_activities: 28,
      development: 9,
      uat: 17,
      training: 2,
    });
  });
});
