-- General student requests (portal problems, ideas, feature requests) answered by Admin.
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "course" "Course" NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "adminNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "request_status" CHECK ("status" IN ('Open', 'In review', 'Planned', 'Done', 'Declined', 'Withdrawn')),
    CONSTRAINT "request_type" CHECK ("type" IN ('Portal problem', 'Improvement idea', 'New feature', 'Account or access', 'Other')),
    CONSTRAINT "request_text" CHECK (char_length("subject") BETWEEN 5 AND 150 AND char_length("description") BETWEEN 10 AND 3000)
);
CREATE INDEX "SupportRequest_studentId_createdAt_idx" ON "SupportRequest"("studentId", "createdAt");
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
