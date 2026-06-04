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

        public async Task<List<CommentDTO>> GetDisputeCommentsAsync(string studentId, string topic)
        {
    throw new System.NotImplementedException("TODO: Team Member 5 - Implement GetDisputeCommentsAsync in ForumService.cs");
}

        public async Task AddCommentAsync(CommentDTO comment)
        {
    throw new System.NotImplementedException("TODO: Team Member 5 - Implement AddCommentAsync in ForumService.cs");
}
    }
}
