using System.Collections.Generic;

namespace CaseLab.DAL.Entities
{
    public class Submission
    {
        public int Id { get; set; }
        public string StudentId { get; set; } = null!;
        public string QuizTitle { get; set; } = null!;
        public string Status { get; set; } = "Pending"; // "Pending", "Graded"
        public decimal FinalScore { get; set; } = 0.00m;
        public string? SurveyPainPoint { get; set; }
        public string DisputeStatus { get; set; } = "None"; // "None", "PendingReview", "Resolved_Accepted", "Resolved_Rejected"

        // Navigation properties
        public virtual User Student { get; set; } = null!;
        public virtual Quiz Quiz { get; set; } = null!;
        public virtual ICollection<SubmissionAnswer> Answers { get; set; } = new List<SubmissionAnswer>();
    }
}
