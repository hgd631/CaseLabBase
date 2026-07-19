using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.Collections.Generic;
using CaseLabBase.DAL.Repositories;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.Web.Controllers.Api
{
    [ApiController]
    [Route("api/notifications")]
    public class NotificationsApiController : ControllerBase
    {
        private readonly NotificationRepository _repo;

        public NotificationsApiController(NotificationRepository repo)
        {
            _repo = repo;
        }

        //Get recent notifications for a user (last 30). Pass userId and role.
        [HttpGet]
        public async Task<IActionResult> GetNotifications([FromQuery] string userId, [FromQuery] string role)
        {
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(role))
                return BadRequest("userId and role are required.");

            var notifications = await _repo.GetForUserAsync(userId, role);
            var unreadCount = await _repo.GetUnreadCountAsync(userId, role);

            return Ok(new
            {
                unreadCount,
                notifications = notifications.ConvertAll(n => new
                {
                    n.Id,
                    n.Title,
                    n.Message,
                    n.LinkUrl,
                    n.IsRead,
                    CreatedAt = n.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ssZ")
                })
            });
        }

        /// <summary>Mark all notifications as read for a user.</summary>
        [HttpPost("mark-read")]
        public async Task<IActionResult> MarkRead([FromQuery] string userId, [FromQuery] string role)
        {
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(role))
                return BadRequest("userId and role are required.");

            await _repo.MarkAllReadAsync(userId, role);
            return Ok(new { Message = "All notifications marked as read." });
        }

        /// <summary>Mark a single notification as read.</summary>
        [HttpPost("mark-single-read/{id}")]
        public async Task<IActionResult> MarkSingleRead(int id)
        {
            await _repo.MarkSingleReadAsync(id);
            return Ok(new { Message = "Notification marked as read." });
        }
    }
}
