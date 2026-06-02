CREATE TABLE "StudyActivityDay" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudyActivityDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudyActivityDay_userId_localDate_key" ON "StudyActivityDay"("userId", "localDate");
CREATE INDEX "StudyActivityDay_userId_idx" ON "StudyActivityDay"("userId");
CREATE INDEX "StudyActivityDay_localDate_idx" ON "StudyActivityDay"("localDate");

ALTER TABLE "StudyActivityDay"
ADD CONSTRAINT "StudyActivityDay_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
