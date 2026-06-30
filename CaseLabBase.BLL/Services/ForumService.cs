using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;

namespace CaseLabBase.BLL.Services
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
    throw new System.NotImplementedException("TODO: Team Member 5 - Implement GetForumTopicCommentsAsync in ForumService.cs");
}




        // Han - Implement GetDisputeCommentsAsync in ForumService.cs
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

        // Han - Implement AddCommentAsync in ForumService.cs
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
