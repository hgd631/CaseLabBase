using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.DAL.Repositories
{
    public class ForumRepository
    {
        private readonly CaseLabBaseDbContext _context;

        public ForumRepository(CaseLabBaseDbContext context)
        {
            _context = context;
        }

        public async Task<List<Comment>> GetPublicCommentsByTopicAsync(string topic)
        {
            return await _context.Comments
                .Where(c => !c.IsPrivate && c.Topic == topic)
                .OrderBy(c => c.Timestamp)
                .ToListAsync();
        }

        public async Task<List<Comment>> GetPrivateCommentsForDisputeAsync(string studentId, string topic)
        {
            return await _context.Comments
                .Where(c => c.IsPrivate && c.StudentId == studentId && c.Topic == topic)
                .OrderBy(c => c.Timestamp)
                .ToListAsync();
        }

        public async Task AddCommentAsync(Comment comment)
        {
            await _context.Comments.AddAsync(comment);
            await _context.SaveChangesAsync();
        }

        public async Task<List<Ticket>> GetAllTicketsAsync()
        {
            return await _context.Tickets
                .Include(t => t.Student)
                .Include(t => t.Question)
                .ToListAsync();
        }

        public async Task<Ticket?> GetTicketAsync(string studentId, int questionId)
        {
            return await _context.Tickets
                .Include(t => t.Student)
                .Include(t => t.Question)
                .FirstOrDefaultAsync(t => t.StudentId == studentId && t.QuestionId == questionId);
        }

        public async Task SaveTicketAsync(Ticket ticket)
        {
            var existing = await _context.Tickets
                .FirstOrDefaultAsync(t => t.StudentId == ticket.StudentId && t.QuestionId == ticket.QuestionId);

            if (existing == null)
            {
                await _context.Tickets.AddAsync(ticket);
            }
            else
            {
                _context.Entry(existing).CurrentValues.SetValues(ticket);
            }
            await _context.SaveChangesAsync();
        }

        public async Task ClearAllTicketsAsync()
        {
            var tickets = await _context.Tickets.ToListAsync();
            _context.Tickets.RemoveRange(tickets);
            await _context.SaveChangesAsync();
        }
    }
}
