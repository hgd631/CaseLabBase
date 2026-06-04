namespace CaseLabBase.DAL.Entities
{
    public class Question
    {
        public int Id { get; set; }
        public string QuizTitle { get; set; } = null!;
        public string Type { get; set; } = null!; // "MCQ" or "Essay"
        public string Topic { get; set; } = null!;
        public string Prompt { get; set; } = null!;
        public string? Options { get; set; } // JSON formatted string for MCQ options
        public string CorrectKey { get; set; } = null!;
        public decimal MaxScore { get; set; } = 0.00m;

        // Navigation properties
        public virtual Quiz Quiz { get; set; } = null!;
    }
}
