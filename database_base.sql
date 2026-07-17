-- Create CaseLabBaseDB database for PostgreSQL
-- CREATE DATABASE "CaseLabBaseDB";

-- Drop tables in dependency order if they exist
DROP TABLE IF EXISTS "Notifications" CASCADE;
DROP TABLE IF EXISTS "Tickets" CASCADE;
DROP TABLE IF EXISTS "Comments" CASCADE;
DROP TABLE IF EXISTS "SubmissionAnswers" CASCADE;
DROP TABLE IF EXISTS "Submissions" CASCADE;
DROP TABLE IF EXISTS "Questions" CASCADE;
DROP TABLE IF EXISTS "Quizzes" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;
DROP TABLE IF EXISTS "ErrorTags" CASCADE;

-- 1. Create Users Table
CREATE TABLE "Users" (
    "Id" VARCHAR(50) PRIMARY KEY,
    "Name" VARCHAR(100) NOT NULL,
    "Role" VARCHAR(50) NOT NULL -- 'student' or 'teacher'
);

-- 2. Create Quizzes Table
CREATE TABLE "Quizzes" (
    "Title" VARCHAR(150) PRIMARY KEY,
    "TimeLimitMinutes" INT NOT NULL DEFAULT 40,
    "IsQuizOpen" BOOLEAN NOT NULL DEFAULT TRUE,
    "IsForumOpen" BOOLEAN NOT NULL DEFAULT TRUE,
    "DeadlineString" VARCHAR(50) NULL,
    "PdfBase64" TEXT NULL,
    "QuizMode" VARCHAR(50) NOT NULL DEFAULT 'Manual',
    "TotalScore" DECIMAL(6,2) NOT NULL DEFAULT 10.00,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Questions Table
CREATE TABLE "Questions" (
    "Id" SERIAL PRIMARY KEY,
    "QuizTitle" VARCHAR(150) NOT NULL,
    "Type" VARCHAR(50) NOT NULL,
    "Topic" VARCHAR(100) NOT NULL,
    "Prompt" TEXT NOT NULL,
    "Options" TEXT NULL,
    "CorrectKey" TEXT NOT NULL,
    "MaxScore" DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    "MarkingGuide" TEXT NULL,
    CONSTRAINT "FK_Questions_Quizzes" FOREIGN KEY ("QuizTitle") REFERENCES "Quizzes"("Title") ON DELETE CASCADE
);

-- 4. Create Submissions Table
CREATE TABLE "Submissions" (
    "Id" SERIAL PRIMARY KEY,
    "StudentId" VARCHAR(50) NOT NULL,
    "QuizTitle" VARCHAR(150) NOT NULL,
    "Status" VARCHAR(50) NOT NULL DEFAULT 'Pending',
    "FinalScore" DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    "SurveyDifficulty" VARCHAR(50) NULL,
    "SurveyPainPoint" TEXT NULL,
    "DisputeStatus" VARCHAR(50) NOT NULL DEFAULT 'None',
    CONSTRAINT "UQ_StudentId_QuizTitle" UNIQUE ("StudentId", "QuizTitle"),
    CONSTRAINT "FK_Submissions_Users" FOREIGN KEY ("StudentId") REFERENCES "Users"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Submissions_Quizzes" FOREIGN KEY ("QuizTitle") REFERENCES "Quizzes"("Title") ON DELETE CASCADE
);

-- 5. Create SubmissionAnswers Table
CREATE TABLE "SubmissionAnswers" (
    "SubmissionId" INT NOT NULL,
    "QuestionId" INT NOT NULL,
    "StudentAnswer" TEXT NULL,
    "IsCorrect" BOOLEAN NULL,
    "TeacherTag" VARCHAR(200) NULL,
    "Difficulty" VARCHAR(50) NULL,
    "CommentNote" TEXT NULL,
    "EarnedScore" DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    "TeacherFeedback" TEXT NULL,
    PRIMARY KEY ("SubmissionId", "QuestionId"),
    CONSTRAINT "FK_SubmissionAnswers_Submissions" FOREIGN KEY ("SubmissionId") REFERENCES "Submissions"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_SubmissionAnswers_Questions" FOREIGN KEY ("QuestionId") REFERENCES "Questions"("Id") ON DELETE NO ACTION
);

-- 6. Create ErrorTags Table
CREATE TABLE "ErrorTags" (
    "Id" SERIAL PRIMARY KEY,
    "Tag" VARCHAR(150) NOT NULL UNIQUE
);

-- 7. Create Comments Table (Forum & Dispute Chat logs)
CREATE TABLE "Comments" (
    "Id" SERIAL PRIMARY KEY,
    "IsPrivate" BOOLEAN NOT NULL DEFAULT FALSE,
    "StudentId" VARCHAR(50) NOT NULL,
    "Topic" VARCHAR(100) NOT NULL,
    "Sender" VARCHAR(100) NOT NULL,
    "Message" TEXT NOT NULL,
    "Timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create Tickets Table
CREATE TABLE "Tickets" (
    "Id" SERIAL PRIMARY KEY,
    "QuestionId" INT NOT NULL,
    "StudentId" VARCHAR(50) NOT NULL,
    "Msg" TEXT NOT NULL,
    "Status" VARCHAR(50) NOT NULL DEFAULT 'Pending',
    CONSTRAINT "FK_Tickets_Users" FOREIGN KEY ("StudentId") REFERENCES "Users"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Tickets_Questions" FOREIGN KEY ("QuestionId") REFERENCES "Questions"("Id") ON DELETE CASCADE
);

-- 9. Create Notifications Table
CREATE TABLE "Notifications" (
    "Id" SERIAL PRIMARY KEY,
    "TargetUserId" VARCHAR(50) NOT NULL,
    "Title" VARCHAR(150) NOT NULL,
    "Message" TEXT NOT NULL,
    "LinkUrl" VARCHAR(300) NULL,
    "IsRead" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Seed: Users & Error Tags only (NO quiz seed data)
-- Create your own quiz from the Instructor Dashboard to test!
-- ============================================================
INSERT INTO "Users" ("Id", "Name", "Role") VALUES
('s1', 'Han Dang', 'student'),
('s2', 'John Smith', 'student'),
('t1', 'Ali Bayeh', 'teacher');

INSERT INTO "ErrorTags" ("Tag") VALUES
('[F1] Wrong Word'),
('[F2] Interface Architecture Deviation'),
('[F3] Logic Error'),
('[F4] Missing Edge Case');
