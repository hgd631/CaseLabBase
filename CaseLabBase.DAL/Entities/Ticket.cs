namespace CaseLabBase.DAL.Entities
{
    public class Ticket
    {
        public int Id { get; set; }
        public int QuestionId { get; set; }
        public string StudentId { get; set; } = null!;
        public string Msg { get; set; } = null!;
        public string Status { get; set; } = "Pending"; // "Pending", "Accepted", "Rejected"

        // Navigation properties
        public virtual User Student { get; set; } = null!;
        public virtual Question Question { get; set; } = null!;
    }
}
