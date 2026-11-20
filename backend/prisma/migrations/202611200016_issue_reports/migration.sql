-- Student issue reports (content, marking or portal problems) reviewed by Admin.
CREATE TABLE "IssueReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "course" "Course" NOT NULL,
    "resultId" TEXT,
    "testName" TEXT NOT NULL DEFAULT '',
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "questions" TEXT[],
    "questionIds" TEXT[],
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "adminNote" TEXT NOT NULL DEFAULT '',
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "IssueReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "issue_status" CHECK ("status" IN ('Open', 'In review', 'Resolved', 'Rejected', 'Withdrawn')),
    CONSTRAINT "issue_module" CHECK ("module" IN ('Listening', 'Reading', 'Writing', 'Speaking', 'General')),
    CONSTRAINT "issue_description" CHECK (char_length("description") BETWEEN 10 AND 2000)
);
CREATE INDEX "IssueReport_studentId_createdAt_idx" ON "IssueReport"("studentId", "createdAt");
CREATE INDEX "IssueReport_status_createdAt_idx" ON "IssueReport"("status", "createdAt");
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
