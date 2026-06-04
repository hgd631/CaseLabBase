namespace CaseLabBase.DAL.Entities
{
    public class User
    {
        public string Id { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Role { get; set; } = null!; // "student" or "teacher"
    }
}
