-- Create CaseLabBaseDB database for Microsoft SQL Server (run in SSMS)
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'CaseLabBaseDB')
BEGIN
    CREATE DATABASE CaseLabBaseDB;
END
GO

USE CaseLabBaseDB;
GO

-- Drop tables in dependency order if they exist
IF OBJECT_ID('dbo.Notifications', 'U') IS NOT NULL DROP TABLE dbo.Notifications;
IF OBJECT_ID('dbo.Tickets', 'U') IS NOT NULL DROP TABLE dbo.Tickets;
IF OBJECT_ID('dbo.Comments', 'U') IS NOT NULL DROP TABLE dbo.Comments;
IF OBJECT_ID('dbo.SubmissionAnswers', 'U') IS NOT NULL DROP TABLE dbo.SubmissionAnswers;
IF OBJECT_ID('dbo.Submissions', 'U') IS NOT NULL DROP TABLE dbo.Submissions;
IF OBJECT_ID('dbo.Questions', 'U') IS NOT NULL DROP TABLE dbo.Questions;
IF OBJECT_ID('dbo.Quizzes', 'U') IS NOT NULL DROP TABLE dbo.Quizzes;
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
IF OBJECT_ID('dbo.ErrorTags', 'U') IS NOT NULL DROP TABLE dbo.ErrorTags;
GO

-- 1. Create Users Table
CREATE TABLE dbo.Users (
    Id NVARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Role NVARCHAR(50) NOT NULL -- 'student' or 'teacher'
);

-- 2. Create Quizzes Table
CREATE TABLE dbo.Quizzes (
    Title NVARCHAR(150) PRIMARY KEY,
    TimeLimitMinutes INT NOT NULL DEFAULT 40,
    IsQuizOpen BIT NOT NULL DEFAULT 1,
    IsForumOpen BIT NOT NULL DEFAULT 1,
    DeadlineString NVARCHAR(50) NULL,
    PdfBase64 NVARCHAR(MAX) NULL,
    QuizMode NVARCHAR(50) NOT NULL DEFAULT 'Manual',
    TotalScore DECIMAL(6,2) NOT NULL DEFAULT 10.00
);

-- 3. Create Questions Table
CREATE TABLE dbo.Questions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    QuizTitle NVARCHAR(150) NOT NULL,
    Type NVARCHAR(50) NOT NULL,
    Topic NVARCHAR(100) NOT NULL,
    Prompt NVARCHAR(MAX) NOT NULL,
    Options NVARCHAR(MAX) NULL,
    CorrectKey NVARCHAR(MAX) NOT NULL,
    MaxScore DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT FK_Questions_Quizzes FOREIGN KEY (QuizTitle) REFERENCES dbo.Quizzes(Title) ON DELETE CASCADE
);

-- 4. Create Submissions Table
CREATE TABLE dbo.Submissions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    StudentId NVARCHAR(50) NOT NULL,
    QuizTitle NVARCHAR(150) NOT NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
    FinalScore DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    SurveyPainPoint NVARCHAR(MAX) NULL,
    DisputeStatus NVARCHAR(50) NOT NULL DEFAULT 'None',
    CONSTRAINT UQ_StudentId_QuizTitle UNIQUE (StudentId, QuizTitle),
    CONSTRAINT FK_Submissions_Users FOREIGN KEY (StudentId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Submissions_Quizzes FOREIGN KEY (QuizTitle) REFERENCES dbo.Quizzes(Title) ON DELETE CASCADE
);

-- 5. Create SubmissionAnswers Table
CREATE TABLE dbo.SubmissionAnswers (
    SubmissionId INT NOT NULL,
    QuestionId INT NOT NULL,
    StudentAnswer NVARCHAR(MAX) NULL,
    IsCorrect BIT NULL,
    TeacherTag NVARCHAR(200) NULL,
    Difficulty NVARCHAR(50) NULL,
    CommentNote NVARCHAR(MAX) NULL,
    EarnedScore DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (SubmissionId, QuestionId),
    CONSTRAINT FK_SubmissionAnswers_Submissions FOREIGN KEY (SubmissionId) REFERENCES dbo.Submissions(Id) ON DELETE CASCADE,
    CONSTRAINT FK_SubmissionAnswers_Questions FOREIGN KEY (QuestionId) REFERENCES dbo.Questions(Id) ON DELETE NO ACTION
);

-- 6. Create ErrorTags Table
CREATE TABLE dbo.ErrorTags (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Tag NVARCHAR(150) NOT NULL UNIQUE
);

-- 7. Create Comments Table (Forum & Dispute Chat logs)
CREATE TABLE dbo.Comments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IsPrivate BIT NOT NULL DEFAULT 0,
    StudentId NVARCHAR(50) NOT NULL,
    Topic NVARCHAR(100) NOT NULL,
    Sender NVARCHAR(100) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    Timestamp DATETIME NOT NULL DEFAULT GETDATE()
);

-- 8. Create Tickets Table
CREATE TABLE dbo.Tickets (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    QuestionId INT NOT NULL,
    StudentId NVARCHAR(50) NOT NULL,
    Msg NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
    CONSTRAINT FK_Tickets_Users FOREIGN KEY (StudentId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Tickets_Questions FOREIGN KEY (QuestionId) REFERENCES dbo.Questions(Id) ON DELETE CASCADE
);

-- 9. Create Notifications Table
CREATE TABLE dbo.Notifications (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    -- 'all-students', 'all-teachers', or specific UserId
    TargetUserId NVARCHAR(50) NOT NULL,
    Title NVARCHAR(150) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    LinkUrl NVARCHAR(300) NULL,
    IsRead BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- ============================================================
-- Seed: Users & Error Tags only (NO quiz seed data)
-- Create your own quiz from the Instructor Dashboard to test!
-- ============================================================
INSERT INTO dbo.Users (Id, Name, Role) VALUES
('s1', 'Han Dang', 'student'),
('s2', 'John Smith', 'student'),
('t1', 'Ali Bayeh', 'teacher');

INSERT INTO dbo.ErrorTags (Tag) VALUES
('[F1] Wrong Word'),
('[F2] Interface Architecture Deviation'),
('[F3] Logic Error'),
('[F4] Missing Edge Case');
GO

PRINT 'CaseLabBaseDB initialized — no quiz seed data. Create your first quiz from the Instructor Dashboard!';
GO
