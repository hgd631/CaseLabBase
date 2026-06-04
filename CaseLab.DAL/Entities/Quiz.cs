using System.Collections.Generic;

namespace CaseLab.DAL.Entities
{
    public class Quiz
    {
        public string Title { get; set; } = null!;
        public int TimeLimitMinutes { get; set; } = 40;
        public bool IsQuizOpen { get; set; } = true;
        public bool IsForumOpen { get; set; } = true;
        public string? DeadlineString { get; set; }
        public string? PdfBase64 { get; set; }
        public string QuizMode { get; set; } = "Manual";
        public decimal TotalScore { get; set; } = 10.00m;

        // Navigation properties
        public virtual ICollection<Question> Questions { get; set; } = new List<Question>();
        public virtual ICollection<Submission> Submissions { get; set; } = new List<Submission>();
    }
}
