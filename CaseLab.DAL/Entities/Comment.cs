using System;

namespace CaseLab.DAL.Entities
{
    public class Comment
    {
        public int Id { get; set; }
        public bool IsPrivate { get; set; }
        public string StudentId { get; set; } = null!; // 'all' for public, or specific ID
        public string Topic { get; set; } = null!;
        public string Sender { get; set; } = null!;
        public string Message { get; set; } = null!;
        public DateTime Timestamp { get; set; } = DateTime.Now;
    }
}
