import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { studentOnly } from "../auth.js";
import { assert, roundBand } from "../domain.js";
import { reports, reportQuery } from "../reports.js";
import { type RouteContext, query } from "./context.js";

// Leaderboard, reports and exports.
export function registerReportRoutes(app: FastifyInstance, { db, config, user }: RouteContext) {
  app.get("/api/leaderboard", async req => {
    const u = user(req);
    studentOnly(u);
    const setting = await db.platformSetting.findUnique({ where: { id: "platform" } });
    assert((setting?.value as { leaderboard?: boolean } | undefined)?.leaderboard, 404, "Leaderboard is disabled");
    const period = z.enum(["Weekly", "Monthly", "Overall"]).parse(query(req).period ?? "Weekly");
    const since = new Date(Date.now() - (period === "Weekly" ? 7 : period === "Monthly" ? 30 : 36500) * 86400000);
    // Latest result per student and test, averaged per student, entirely in PostgreSQL (no row cap).
    const ranked = await db.$queryRaw<Array<{ name: string; average: number; completed: number }>>`
      SELECT u."name",AVG(x."overall")::float AS average,count(*)::int AS completed FROM (
        SELECT DISTINCT ON (r."studentId",r."testId") r."studentId",r."overall" FROM "Result" r
        WHERE r."course"=${u.student.course}::"Course" AND r."date">=${since} AND r."overall" IS NOT NULL
          AND ((r."kind"='FLT' AND r."released") OR (r."kind"='PRACTICE_MOCK' AND r."writing" IS NOT NULL AND r."listening" IS NOT NULL AND r."reading" IS NOT NULL))
        ORDER BY r."studentId",r."testId",r."date" DESC) x JOIN "User" u ON u."id"=x."studentId" GROUP BY x."studentId",u."name"`;
    return ranked
      .map(r => {
        const names = r.name.split(/\s+/);
        return { name: `${names[0]} ${names.at(-1)?.[0] ?? ""}.`, band: roundBand(r.average), completed: r.completed };
      })
      .sort((a, b) => b.band - a.band || a.name.localeCompare(b.name))
      .slice(0, 100);
  });
  app.get("/api/reports", async req =>
    reports(db, user(req), reportQuery.parse(req.query), false, config.ACCESS_TIMEZONE),
  );
  app.get("/api/reports/export", async (req, reply) => {
    const result = await reports(db, user(req), reportQuery.parse(req.query), true, config.ACCESS_TIMEZONE);
    return reply
      .header("Content-Disposition", 'attachment; filename="academic-report.csv"')
      .type("text/csv; charset=utf-8")
      .send(result);
  });
}
