using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CaseLab.DAL.Entities;

namespace CaseLab.DAL.Repositories
{
    public class UserRepository
    {
        private readonly CaseLabDbContext _context;

        public UserRepository(CaseLabDbContext context)
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
