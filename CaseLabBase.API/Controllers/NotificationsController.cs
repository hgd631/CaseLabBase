using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.Collections.Generic;
using CaseLabBase.DAL.Repositories;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly NotificationRepository _repo;

        public NotificationsController(NotificationRepository repo)
        {
            _repo = repo;
        }

        //Get recent notifications for a user (last 30) based on path userId.
        [HttpGet("{userId}")]
        public async Task<IActionResult> GetNotifications(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                return BadRequest("userId is required.");

            // Determine role dynamically: teacher if ID starts with 't', student otherwise
            string role = userId.StartsWith("t") ? "teacher" : "student";

            var notifications = await _repo.GetForUserAsync(userId, role);
            var unreadCount = await _repo.GetUnreadCountAsync(userId, role);

            return Ok(notifications.ConvertAll(n => new
            {
                n.Id,
                n.Title,
                n.Message,
                n.LinkUrl,
                n.IsRead,
                CreatedAt = n.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ssZ")
            }));
        }

        /// Mark all notifications as read for a user.
        [HttpPost("read-all/{userId}")]
        public async Task<IActionResult> MarkAllRead(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                return BadRequest("userId is required.");

            string role = userId.StartsWith("t") ? "teacher" : "student";

            await _repo.MarkAllReadAsync(userId, role);
            return Ok(new { Message = "All notifications marked as read." });
        }

        /// Mark a single notification as read.
        [HttpPost("read/{id}")]
        public async Task<IActionResult> MarkSingleRead(int id)
        {
            await _repo.MarkSingleReadAsync(id);
            return Ok(new { Message = "Notification marked as read." });
        }
    }
}
