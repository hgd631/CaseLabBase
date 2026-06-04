using System;
using System.Collections.Generic;

namespace CaseLab.BLL.DTOs
{
    public class UserDTO
    {
        public string Id { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Role { get; set; } = null!;
    }

    public class QuizDTO
    {
        public string Title { get; set; } = null!;
        public int TimeLimitMinutes { get; set; } = 40;
        public bool IsQuizOpen { get; set; } = true;
        public bool IsForumOpen { get; set; } = true;
        public string? DeadlineString { get; set; }
        public string? PdfBase64 { get; set; }
        public string QuizMode { get; set; } = "Manual";
        public decimal TotalScore { get; set; } = 10.00m;
    }

    public class QuestionDTO
    {
        public int Id { get; set; }
        public string Type { get; set; } = null!; // "MCQ", "Essay"
        public string Topic { get; set; } = null!;
        public string Prompt { get; set; } = null!;
        public List<string>? Options { get; set; } // Deserialized list
        public string CorrectKey { get; set; } = null!;
        public decimal MaxScore { get; set; } = 0.00m;
    }

    public class SubmissionAnswerDTO
    {
        public int QuestionId { get; set; }
        public string QuestionPrompt { get; set; } = null!;
        public string QuestionTopic { get; set; } = null!;
        public string QuestionType { get; set; } = null!;
        public string? StudentAnswer { get; set; }
        public bool? IsCorrect { get; set; }
        public string? TeacherTag { get; set; }
        public string? Difficulty { get; set; }
        public string? CommentNote { get; set; }
        public decimal MaxScore { get; set; } = 0.00m;
        public decimal EarnedScore { get; set; } = 0.00m;

        // Diagnostic rates based on student reflections for this quiz
        public decimal EasyRate { get; set; }
        public decimal MediumRate { get; set; }
        public decimal HardRate { get; set; }
    }

    public class SubmissionDTO
    {
        public string StudentId { get; set; } = null!;
        public string StudentName { get; set; } = null!;
        public string Status { get; set; } = null!;
        public decimal FinalScore { get; set; }
        public string? SurveyPainPoint { get; set; }
        public string DisputeStatus { get; set; } = null!;
        public List<SubmissionAnswerDTO> Answers { get; set; } = new();
    }

    public class CommentDTO
    {
        public int Id { get; set; }
        public bool IsPrivate { get; set; }
        public string StudentId { get; set; } = null!;
        public string Topic { get; set; } = null!;
        public string Sender { get; set; } = null!;
        public string Message { get; set; } = null!;
        public DateTime Timestamp { get; set; }
    }

    public class TicketDTO
    {
        public int Id { get; set; }
        public int QuestionId { get; set; }
        public string StudentId { get; set; } = null!;
        public string StudentName { get; set; } = null!;
        public string Msg { get; set; } = null!;
        public string Status { get; set; } = null!;
    }

    // Requests models
    public class PublishTaskRequest
    {
        public string Title { get; set; } = null!;
        public List<QuestionDTO> Questions { get; set; } = new();
        public int TimeLimitMinutes { get; set; } = 40;
        public bool IsQuizOpen { get; set; } = true;
        public bool IsForumOpen { get; set; } = true;
        public string? DeadlineString { get; set; }
        public string? PdfBase64 { get; set; }
        public string QuizMode { get; set; } = "Manual";
        public decimal TotalScore { get; set; } = 10.00m;
    }

    public class SubmitExamRequest
    {
        public string StudentId { get; set; } = null!;
        public string QuizTitle { get; set; } = null!;
        public List<SubmitAnswerRequestItem> Answers { get; set; } = new();
    }

    public class SubmitAnswerRequestItem
    {
        public int QuestionId { get; set; }
        public string? StudentAnswer { get; set; }
    }

    public class SubmitSurveyRequest
    {
        public string StudentId { get; set; } = null!;
        public string QuizTitle { get; set; } = null!;
        public List<SubmitSurveyRequestItem> Reflections { get; set; } = new();
    }

    public class SubmitSurveyRequestItem
    {
        public int QuestionId { get; set; }
        public string Difficulty { get; set; } = null!; // "Easy", "Medium", "Hard"
        public string? CommentNote { get; set; }
    }

    public class InitiateDisputeRequest
    {
        public string StudentId { get; set; } = null!;
        public int QuestionId { get; set; }
        public string Message { get; set; } = null!;
    }

    public class DisputeChatRequest
    {
        public string StudentId { get; set; } = null!;
        public int QuestionId { get; set; }
        public string Sender { get; set; } = null!;
        public string Message { get; set; } = null!;
    }

    public class GradeSubmissionRequest
    {
        public string StudentId { get; set; } = null!;
        public string QuizTitle { get; set; } = null!;
        public List<GradeQuestionItem> Grades { get; set; } = new();
    }

    public class GradeQuestionItem
    {
        public int QuestionId { get; set; }
        public decimal EarnedScore { get; set; }
        public string? ChosenTag { get; set; }
    }

    public class ResolveDisputeRequest
    {
        public string StudentId { get; set; } = null!;
        public string QuizTitle { get; set; } = null!;
        public int QuestionId { get; set; }
        public bool IsApproved { get; set; }
        public decimal ManualOverrideScore { get; set; }
    }

    public class ClassAnalyticsDTO
    {
        public string ActiveTaskTitle { get; set; } = null!;
        public int TotalSubmissionsCount { get; set; }
        public int GradedCount { get; set; }
        public decimal FailureRatePercentage { get; set; }
        public decimal ClassAverageScore { get; set; }
    }
}
