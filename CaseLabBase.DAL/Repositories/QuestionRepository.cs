using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.DAL.Repositories
{
    public class QuestionRepository
    {
        private readonly CaseLabBaseDbContext _context;

        public QuestionRepository(CaseLabBaseDbContext context)
        {
            _context = context;
        }

        public async Task<List<Question>> GetAllAsync()
        {
            return await _context.Questions.ToListAsync();
        }

        public async Task<List<Question>> GetByQuizTitleAsync(string quizTitle)
        {
            return await _context.Questions.Where(q => q.QuizTitle == quizTitle).ToListAsync();
        }

        public async Task<Question?> GetByIdAsync(int id)
        {
            return await _context.Questions.FindAsync(id);
        }

        public async Task AddAsync(Question question)
        {
            await _context.Questions.AddAsync(question);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Question question)
        {
            _context.Questions.Update(question);
            await _context.SaveChangesAsync();
        }

        public async Task ClearAllAsync()
        {
            var questions = await _context.Questions.ToListAsync();
            _context.Questions.RemoveRange(questions);
            await _context.SaveChangesAsync();
        }

        // Quiz operations
        public async Task<List<Quiz>> GetQuizzesAsync()
        {
            return await _context.Quizzes.OrderByDescending(q => q.CreatedAt).ToListAsync();
        }

        public async Task<Quiz?> GetQuizByTitleAsync(string title)
        {
            return await _context.Quizzes.FindAsync(title);
        }

        public async Task AddQuizAsync(Quiz quiz)
        {
            await _context.Quizzes.AddAsync(quiz);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateQuizAsync(Quiz quiz)
        {
            _context.Quizzes.Update(quiz);
            await _context.SaveChangesAsync();
        }
    }
}
