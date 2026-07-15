namespace CaseLabBase.DAL.Entities
{
    public class SubmissionAnswer
    {
        public int SubmissionId { get; set; }
        public int QuestionId { get; set; }
        public string? StudentAnswer { get; set; }
        public bool? IsCorrect { get; set; }
        public string? TeacherTag { get; set; }
        public string? Difficulty { get; set; }
        public string? CommentNote { get; set; }
        public decimal EarnedScore { get; set; } = 0.00m;

        public string? TeacherFeedback { get; set; }

        // Navigation properties
        public virtual Submission Submission { get; set; } = null!;
        public virtual Question Question { get; set; } = null!;
    }
}
