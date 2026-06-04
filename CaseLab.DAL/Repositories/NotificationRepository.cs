using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CaseLab.DAL.Entities;

namespace CaseLab.DAL.Repositories
{
    public class NotificationRepository
    {
        private readonly CaseLabDbContext _context;

        public NotificationRepository(CaseLabDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Get unread notifications for a specific user (includes targeted + broadcast to their role group).
        /// </summary>
        public async Task<List<Notification>> GetForUserAsync(string userId, string role)
        {
            // Match: specific user, or broadcast to all-students/all-teachers
            var broadcast = role == "student" ? "all-students" : "all-teachers";

            return await _context.Notifications
                .Where(n => n.TargetUserId == userId || n.TargetUserId == broadcast)
                .OrderByDescending(n => n.CreatedAt)
                .Take(30)
                .ToListAsync();
        }

        /// <summary>Get count of unread notifications for a user.</summary>
        public async Task<int> GetUnreadCountAsync(string userId, string role)
        {
            var broadcast = role == "student" ? "all-students" : "all-teachers";
            return await _context.Notifications
                .CountAsync(n => !n.IsRead && (n.TargetUserId == userId || n.TargetUserId == broadcast));
        }

        /// <summary>Mark all notifications for a user as read.</summary>
        public async Task MarkAllReadAsync(string userId, string role)
        {
            var broadcast = role == "student" ? "all-students" : "all-teachers";
            var toUpdate = await _context.Notifications
                .Where(n => !n.IsRead && (n.TargetUserId == userId || n.TargetUserId == broadcast))
                .ToListAsync();

            foreach (var n in toUpdate) n.IsRead = true;
            await _context.SaveChangesAsync();
        }

        /// <summary>Create a single notification.</summary>
        public async Task CreateAsync(Notification notification)
        {
            await _context.Notifications.AddAsync(notification);
            await _context.SaveChangesAsync();
        }

        /// <summary>Convenience: broadcast to all students.</summary>
        public async Task NotifyAllStudentsAsync(string title, string message, string? linkUrl = null)
        {
            var n = new Notification
            {
                TargetUserId = "all-students",
                Title = title,
                Message = message,
                LinkUrl = linkUrl,
                CreatedAt = DateTime.UtcNow
            };
            await CreateAsync(n);
        }

        /// <summary>Convenience: notify all teachers.</summary>
        public async Task NotifyAllTeachersAsync(string title, string message, string? linkUrl = null)
        {
            var n = new Notification
            {
                TargetUserId = "all-teachers",
                Title = title,
                Message = message,
                LinkUrl = linkUrl,
                CreatedAt = DateTime.UtcNow
            };
            await CreateAsync(n);
        }

        /// <summary>Convenience: notify a specific user.</summary>
        public async Task NotifyUserAsync(string userId, string title, string message, string? linkUrl = null)
        {
            var n = new Notification
            {
                TargetUserId = userId,
                Title = title,
                Message = message,
                LinkUrl = linkUrl,
                CreatedAt = DateTime.UtcNow
            };
            await CreateAsync(n);
        }
    }
}
