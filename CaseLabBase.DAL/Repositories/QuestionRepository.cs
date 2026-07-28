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
        // Constructor that initializes the repository with the database context.
        public QuestionRepository(CaseLabBaseDbContext context)
        {
            _context = context;
        }
        // Retrieves all questions from the database.
        public async Task<List<Question>> GetAllAsync()
        {
            return await _context.Questions.ToListAsync();
        }
        // Retrieves questions by quiz title from the database.
        public async Task<List<Question>> GetByQuizTitleAsync(string quizTitle)
        {
            return await _context.Questions.Where(q => q.QuizTitle == quizTitle).ToListAsync();
        }
        // Retrieves a question by its ID from the database.
        public async Task<Question?> GetByIdAsync(int id)
        {
            return await _context.Questions.FindAsync(id);
        }
        // Adds a new question to the database.
        public async Task AddAsync(Question question)
        {
            await _context.Questions.AddAsync(question);
            await _context.SaveChangesAsync();
        }
        // Updates an existing question in the database.
        public async Task UpdateAsync(Question question)
        {
            _context.Questions.Update(question);
            await _context.SaveChangesAsync();
        }
        // Deletes a question from the database.
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

        public async Task DeleteQuizAsync(Quiz quiz)
        {
            _context.Quizzes.Remove(quiz);
            await _context.SaveChangesAsync();
        }
    }
}
