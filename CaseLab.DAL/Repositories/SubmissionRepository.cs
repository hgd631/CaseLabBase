using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CaseLab.DAL.Entities;

namespace CaseLab.DAL.Repositories
{
    public class SubmissionRepository
    {
        private readonly CaseLabDbContext _context;

        public SubmissionRepository(CaseLabDbContext context)
        {
            _context = context;
        }

        public async Task<List<Submission>> GetAllWithAnswersAsync()
        {
            return await _context.Submissions
                .Include(s => s.Student)
                .Include(s => s.Answers)
                    .ThenInclude(a => a.Question)
                .ToListAsync();
        }

        public async Task<List<Submission>> GetSubmissionsByQuizWithAnswersAsync(string quizTitle)
        {
            return await _context.Submissions
                .Include(s => s.Student)
                .Include(s => s.Answers)
                    .ThenInclude(a => a.Question)
                .Where(s => s.QuizTitle == quizTitle)
                .ToListAsync();
        }

        public async Task<Submission?> GetByStudentIdWithAnswersAsync(string studentId)
        {
            return await _context.Submissions
                .Include(s => s.Student)
                .Include(s => s.Answers)
                    .ThenInclude(a => a.Question)
                .FirstOrDefaultAsync(s => s.StudentId == studentId);
        }

        public async Task<Submission?> GetByStudentIdAndQuizWithAnswersAsync(string studentId, string quizTitle)
        {
            return await _context.Submissions
                .Include(s => s.Student)
                .Include(s => s.Answers)
                    .ThenInclude(a => a.Question)
                .FirstOrDefaultAsync(s => s.StudentId == studentId && s.QuizTitle == quizTitle);
        }

        /// <summary>
        /// Inserts a new Submission or updates an existing one by (StudentId, QuizTitle).
        /// After the call, submission.Id is guaranteed to reflect the real database row Id.
        /// Uses direct property assignments instead of SetValues to avoid EF Core PK mutation errors.
        /// </summary>
        public async Task SaveSubmissionAsync(Submission submission)
        {
            var existing = await _context.Submissions
                .FirstOrDefaultAsync(s => s.StudentId == submission.StudentId && s.QuizTitle == submission.QuizTitle);

            if (existing == null)
            {
                // INSERT path: let EF Core populate submission.Id after SaveChangesAsync
                _context.Submissions.Add(submission);
                await _context.SaveChangesAsync();
                // submission.Id is now the real identity-generated PK
            }
            else
            {
                // UPDATE path: mutate the already-tracked entity directly (no SetValues)
                submission.Id = existing.Id; // give the caller the real Id
                existing.Status = submission.Status;
                existing.FinalScore = submission.FinalScore;
                existing.SurveyPainPoint = submission.SurveyPainPoint;
                existing.DisputeStatus = submission.DisputeStatus;
                await _context.SaveChangesAsync();
            }
        }

        /// <summary>
        /// Inserts a new SubmissionAnswer or updates an existing one by (SubmissionId, QuestionId).
        /// Uses direct property assignments instead of SetValues.
        /// </summary>
        public async Task SaveSubmissionAnswerAsync(SubmissionAnswer answer)
        {
            var existing = await _context.SubmissionAnswers
                .FirstOrDefaultAsync(a => a.SubmissionId == answer.SubmissionId && a.QuestionId == answer.QuestionId);

            if (existing == null)
            {
                _context.SubmissionAnswers.Add(answer);
                await _context.SaveChangesAsync();
            }
            else
            {
                existing.StudentAnswer = answer.StudentAnswer;
                existing.IsCorrect = answer.IsCorrect;
                existing.TeacherTag = answer.TeacherTag;
                existing.Difficulty = answer.Difficulty;
                existing.CommentNote = answer.CommentNote;
                existing.EarnedScore = answer.EarnedScore;
                await _context.SaveChangesAsync();
            }
        }

        public async Task ClearAllSubmissionsAsync()
        {
            var submissions = await _context.Submissions.ToListAsync();
            _context.Submissions.RemoveRange(submissions);
            await _context.SaveChangesAsync();
        }

        // ErrorTags CRUD
        public async Task<List<ErrorTag>> GetErrorTagsAsync()
        {
            return await _context.ErrorTags.ToListAsync();
        }

        public async Task AddErrorTagAsync(ErrorTag tag)
        {
            await _context.ErrorTags.AddAsync(tag);
            await _context.SaveChangesAsync();
        }
    }
}
