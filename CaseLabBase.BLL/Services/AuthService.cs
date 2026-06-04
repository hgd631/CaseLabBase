using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.DAL.Repositories;

namespace CaseLabBase.BLL.Services
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
    throw new System.NotImplementedException("TODO: Team Member 1 - Implement GetUserByIdAsync in AuthService.cs");
}
    }
}
