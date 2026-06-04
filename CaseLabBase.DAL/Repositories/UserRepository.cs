using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.DAL.Repositories
{
    public class UserRepository
    {
        private readonly CaseLabBaseDbContext _context;

        public UserRepository(CaseLabBaseDbContext context)
        {
            _context = context;
        }

        public async Task<List<User>> GetAllAsync()
        {
            return await _context.Users.ToListAsync();
        }

        public async Task<User?> GetByIdAsync(string id)
        {
            return await _context.Users.FindAsync(id);
        }
    }
}
