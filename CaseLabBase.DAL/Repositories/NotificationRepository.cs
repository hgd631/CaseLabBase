using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.DAL.Repositories
{
    public class NotificationRepository
    {
        private readonly CaseLabBaseDbContext _context;

        public NotificationRepository(CaseLabBaseDbContext context)
        {
            _context = context;
        }

        // Get unread notifications for a specific user (includes targeted + broadcast to their role group).
        
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

        //Get count of unread notifications for a user.
        public async Task<int> GetUnreadCountAsync(string userId, string role)
        {
            var broadcast = role == "student" ? "all-students" : "all-teachers";
            return await _context.Notifications
                .CountAsync(n => !n.IsRead && (n.TargetUserId == userId || n.TargetUserId == broadcast));
        }

        //Mark all notifications for a user as read.
        public async Task MarkAllReadAsync(string userId, string role)
        {
            var broadcast = role == "student" ? "all-students" : "all-teachers";
            var toUpdate = await _context.Notifications
                .Where(n => !n.IsRead && (n.TargetUserId == userId || n.TargetUserId == broadcast))
                .ToListAsync();

            foreach (var n in toUpdate) n.IsRead = true;
            await _context.SaveChangesAsync();
        }

        //Mark a single notification as read.
        public async Task MarkSingleReadAsync(int id)
        {
            var n = await _context.Notifications.FindAsync(id);
            if (n != null)
            {
                n.IsRead = true;
                await _context.SaveChangesAsync();
            }
        }

        //Create a single notification.
        public async Task CreateAsync(Notification notification)
        {
            await _context.Notifications.AddAsync(notification);
            await _context.SaveChangesAsync();
        }

        //broadcast to all students.
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

        //notify all teachers.
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

        //notify a specific user.
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
