using System;

namespace CaseLabBase.DAL.Entities
{
    public class Notification
    {
        public int Id { get; set; }
        //all-students', 'all-teachers', or a specific UserId
        public string TargetUserId { get; set; } = null!;
        public string Title { get; set; } = null!;
        public string Message { get; set; } = null!;
        public string? LinkUrl { get; set; }
        public bool IsRead { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
