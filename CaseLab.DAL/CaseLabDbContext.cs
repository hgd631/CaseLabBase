using Microsoft.EntityFrameworkCore;
using CaseLab.DAL.Entities;

namespace CaseLab.DAL
{
    public class CaseLabDbContext : DbContext
    {
        public CaseLabDbContext(DbContextOptions<CaseLabDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Quiz> Quizzes { get; set; } = null!;
        public DbSet<Question> Questions { get; set; } = null!;
        public DbSet<Submission> Submissions { get; set; } = null!;
        public DbSet<SubmissionAnswer> SubmissionAnswers { get; set; } = null!;
        public DbSet<ErrorTag> ErrorTags { get; set; } = null!;
        public DbSet<Comment> Comments { get; set; } = null!;
        public DbSet<Ticket> Tickets { get; set; } = null!;
        public DbSet<Notification> Notifications { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure Users Table
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("Users");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasMaxLength(50);
                entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Role).HasMaxLength(50).IsRequired();
            });

            // Configure Quizzes Table
            modelBuilder.Entity<Quiz>(entity =>
            {
                entity.ToTable("Quizzes");
                entity.HasKey(e => e.Title);
                entity.Property(e => e.Title).HasMaxLength(150);
                entity.Property(e => e.TimeLimitMinutes).HasDefaultValue(40);
                entity.Property(e => e.IsQuizOpen).HasDefaultValue(true);
                entity.Property(e => e.IsForumOpen).HasDefaultValue(true);
                entity.Property(e => e.DeadlineString).HasMaxLength(50);
                entity.Property(e => e.PdfBase64);
                entity.Property(e => e.QuizMode).HasMaxLength(50).HasDefaultValue("Manual");
                entity.Property(e => e.TotalScore).HasColumnType("decimal(6,2)").HasDefaultValue(10.00m);
            });

            // Configure Questions Table
            modelBuilder.Entity<Question>(entity =>
            {
                entity.ToTable("Questions");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.QuizTitle).HasMaxLength(150).IsRequired();
                entity.Property(e => e.Type).HasMaxLength(50).IsRequired();
                entity.Property(e => e.Topic).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Prompt).IsRequired();
                entity.Property(e => e.CorrectKey).IsRequired();
                entity.Property(e => e.MaxScore).HasColumnType("decimal(6,2)").HasDefaultValue(0.00m);

                entity.HasOne(d => d.Quiz)
                    .WithMany(p => p.Questions)
                    .HasForeignKey(d => d.QuizTitle)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure Submissions Table
            modelBuilder.Entity<Submission>(entity =>
            {
                entity.ToTable("Submissions");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).ValueGeneratedOnAdd();
                entity.Property(e => e.StudentId).HasMaxLength(50).IsRequired();
                entity.Property(e => e.QuizTitle).HasMaxLength(150).IsRequired();
                entity.Property(e => e.Status).HasMaxLength(50).IsRequired().HasDefaultValue("Pending");
                entity.Property(e => e.FinalScore).HasColumnType("decimal(6,2)").HasDefaultValue(0.00m);
                entity.Property(e => e.DisputeStatus).HasMaxLength(50).IsRequired().HasDefaultValue("None");

                entity.HasIndex(e => new { e.StudentId, e.QuizTitle }).IsUnique();

                entity.HasOne(d => d.Student)
                    .WithMany()
                    .HasForeignKey(d => d.StudentId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(d => d.Quiz)
                    .WithMany(p => p.Submissions)
                    .HasForeignKey(d => d.QuizTitle)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure SubmissionAnswers Table (Composite Key)
            modelBuilder.Entity<SubmissionAnswer>(entity =>
            {
                entity.ToTable("SubmissionAnswers");
                entity.HasKey(e => new { e.SubmissionId, e.QuestionId });
                entity.Property(e => e.TeacherTag).HasMaxLength(200);
                entity.Property(e => e.Difficulty).HasMaxLength(50);
                entity.Property(e => e.EarnedScore).HasColumnType("decimal(6,2)").HasDefaultValue(0.00m);

                entity.HasOne(d => d.Submission)
                    .WithMany(p => p.Answers)
                    .HasForeignKey(d => d.SubmissionId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(d => d.Question)
                    .WithMany()
                    .HasForeignKey(d => d.QuestionId)
                    .OnDelete(DeleteBehavior.NoAction); // NO ACTION to avoid SQL Server multiple-cascade-path error
            });

            // Configure ErrorTags Table
            modelBuilder.Entity<ErrorTag>(entity =>
            {
                entity.ToTable("ErrorTags");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Tag).HasMaxLength(150).IsRequired();
                entity.HasIndex(e => e.Tag).IsUnique();
            });

            // Configure Comments Table
            modelBuilder.Entity<Comment>(entity =>
            {
                entity.ToTable("Comments");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.StudentId).HasMaxLength(50).IsRequired();
                entity.Property(e => e.Topic).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Sender).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Message).IsRequired();
                entity.Property(e => e.Timestamp).HasDefaultValueSql("GETDATE()");
            });

            // Configure Tickets Table
            modelBuilder.Entity<Ticket>(entity =>
            {
                entity.ToTable("Tickets");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.StudentId).HasMaxLength(50).IsRequired();
                entity.Property(e => e.Status).HasMaxLength(50).IsRequired().HasDefaultValue("Pending");

                entity.HasOne(d => d.Student)
                    .WithMany()
                    .HasForeignKey(d => d.StudentId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(d => d.Question)
                    .WithMany()
                    .HasForeignKey(d => d.QuestionId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure Notifications Table
            modelBuilder.Entity<Notification>(entity =>
            {
                entity.ToTable("Notifications");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.TargetUserId).HasMaxLength(50).IsRequired();
                entity.Property(e => e.Title).HasMaxLength(150).IsRequired();
                entity.Property(e => e.Message).IsRequired();
                entity.Property(e => e.LinkUrl).HasMaxLength(300);
                entity.Property(e => e.IsRead).HasDefaultValue(false);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETDATE()");
            });
        }
    }
}
