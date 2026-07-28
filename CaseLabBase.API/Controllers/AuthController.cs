using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using CaseLabBase.BLL.Services;

namespace CaseLabBase.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // This controller handles authentication-related API endpoints.
    public class AuthController : ControllerBase
    {
        private readonly AuthService _authService;

        public AuthController(AuthService authService)
        {
            _authService = authService;
        }

        [HttpGet("users")]
        // GET: api/auth/users
        // This endpoint retrieves a list of all users.
        public async Task<IActionResult> GetAllUsers()
        {
            var list = await _authService.GetAllUsersAsync();
            return Ok(list);
        }
        // GET: api/auth/users/{id}
        // This endpoint retrieves a specific user by their ID.
        [HttpGet("users/{id}")]
        public async Task<IActionResult> GetUserById(string id)
        {
            var user = await _authService.GetUserByIdAsync(id);
            if (user == null) return NotFound($"User with ID {id} not found.");
            return Ok(user);
        }
    }
}
