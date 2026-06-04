using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLab.BLL.DTOs;
using CaseLab.DAL.Entities;
using CaseLab.DAL.Repositories;

namespace CaseLab.BLL.Services
{
    public class ForumService
    {
        private readonly ForumRepository _forumRepository;

        public ForumService(ForumRepository forumRepository)
        {
            _forumRepository = forumRepository;
        }

        public async Task<List<CommentDTO>> GetForumTopicCommentsAsync(string topic)
        {
            var list = await _forumRepository.GetPublicCommentsByTopicAsync(topic);
            return list.Select(c => new CommentDTO
            {
                Id = c.Id,
                IsPrivate = c.IsPrivate,
                StudentId = c.StudentId,
                Topic = c.Topic,
                Sender = c.Sender,
                Message = c.Message,
                Timestamp = c.Timestamp
            }).ToList();
        }

        public async Task<List<CommentDTO>> GetDisputeCommentsAsync(string studentId, string topic)
        {
            var list = await _forumRepository.GetPrivateCommentsForDisputeAsync(studentId, topic);
            return list.Select(c => new CommentDTO
            {
                Id = c.Id,
                IsPrivate = c.IsPrivate,
                StudentId = c.StudentId,
                Topic = c.Topic,
                Sender = c.Sender,
                Message = c.Message,
                Timestamp = c.Timestamp
            }).ToList();
        }

        public async Task AddCommentAsync(CommentDTO comment)
        {
            var commentEntity = new Comment
            {
                IsPrivate = comment.IsPrivate,
                StudentId = comment.StudentId,
                Topic = comment.Topic,
                Sender = comment.Sender,
                Message = comment.Message,
                Timestamp = comment.Timestamp
            };
            await _forumRepository.AddCommentAsync(commentEntity);
        }
    }
}
