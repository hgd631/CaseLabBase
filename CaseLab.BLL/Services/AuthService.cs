using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLab.BLL.DTOs;
using CaseLab.DAL.Repositories;

namespace CaseLab.BLL.Services
{
    public class AuthService
    {
        private readonly UserRepository _userRepository;

        public AuthService(UserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<List<UserDTO>> GetAllUsersAsync()
        {
            var users = await _userRepository.GetAllAsync();
            return users.Select(u => new UserDTO
            {
                Id = u.Id,
                Name = u.Name,
                Role = u.Role
            }).ToList();
        }

        public async Task<UserDTO?> GetUserByIdAsync(string id)
        {
            var u = await _userRepository.GetByIdAsync(id);
            if (u == null) return null;
            return new UserDTO
            {
                Id = u.Id,
                Name = u.Name,
                Role = u.Role
            };
        }
    }
}
