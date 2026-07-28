using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.DAL.Repositories
{
    public class SubmissionRepository
    {
        private readonly CaseLabBaseDbContext _context;
        // Constructor that initializes the repository with the database context.
        public SubmissionRepository(CaseLabBaseDbContext context)
        {
            _context = context;
        }
        // Retrieves all submissions along with their associated student and answers, including the related questions for each answer.
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


        // Inserts a new Submission or updates an existing one by (StudentId, QuizTitle).

        public async Task SaveSubmissionAsync(Submission submission)
        {
            var existing = await _context.Submissions
                .FirstOrDefaultAsync(s => s.StudentId == submission.StudentId && s.QuizTitle == submission.QuizTitle);

            if (existing == null)
            {
                // INSERT path: add the new entity to the context
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


        // Inserts a new SubmissionAnswer or updates an existing one by (SubmissionId, QuestionId).
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
                existing.TeacherFeedback = answer.TeacherFeedback;
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

        public async Task RenameErrorTagAsync(string oldTag, string newTag)
        {
            if (string.IsNullOrWhiteSpace(oldTag) || string.IsNullOrWhiteSpace(newTag) || oldTag == newTag) return;

            var tagEntity = await _context.ErrorTags.FirstOrDefaultAsync(t => t.Tag == oldTag);
            if (tagEntity != null)
            {
                var newTagEntity = await _context.ErrorTags.FirstOrDefaultAsync(t => t.Tag == newTag);
                if (newTagEntity != null)
                {
                    _context.ErrorTags.Remove(tagEntity);
                }
                else
                {
                    tagEntity.Tag = newTag;
                }
            }

            var answers = await _context.SubmissionAnswers.Where(a => a.TeacherTag == oldTag).ToListAsync();
            foreach (var answer in answers)
            {
                answer.TeacherTag = newTag;
            }

            var oldTopicSuffix = " - Resource - " + oldTag;
            var newTopicSuffix = " - Resource - " + newTag;
            var comments = await _context.Comments.Where(c => c.Topic.EndsWith(oldTopicSuffix)).ToListAsync();
            foreach (var comment in comments)
            {
                if (comment.Topic.EndsWith(oldTopicSuffix))
                {
                    comment.Topic = comment.Topic.Substring(0, comment.Topic.Length - oldTopicSuffix.Length) + newTopicSuffix;
                }
            }

            await _context.SaveChangesAsync();
        }

        public async Task DeleteSubmissionsByQuizTitleAsync(string quizTitle)
        {
            var list = await _context.Submissions.Where(s => s.QuizTitle == quizTitle).ToListAsync();
            _context.Submissions.RemoveRange(list);
            await _context.SaveChangesAsync();
        }
    }
}
