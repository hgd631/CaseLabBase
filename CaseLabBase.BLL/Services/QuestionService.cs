using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;

namespace CaseLabBase.BLL.Services
{
    public class QuestionService
    {
        private readonly QuestionRepository _questionRepository;
        private readonly SubmissionRepository _submissionRepository;
        private readonly ForumRepository _forumRepository;

        public QuestionService(
            QuestionRepository questionRepository,
            SubmissionRepository submissionRepository,
            ForumRepository forumRepository)
        {
            _questionRepository = questionRepository;
            _submissionRepository = submissionRepository;
            _forumRepository = forumRepository;
        }

        public async Task<List<QuizDTO>> GetAllQuizzesAsync()
        {
    throw new System.NotImplementedException("TODO: Team Member 1 - Implement GetAllQuizzesAsync in QuestionService.cs");
}

        public async Task<List<QuestionDTO>> GetActiveQuestionsAsync(string quizTitle)
        {
    throw new System.NotImplementedException("TODO: Team Member 2 - Implement GetActiveQuestionsAsync in QuestionService.cs");
}

        public async Task PublishNewTaskAsync(PublishTaskRequest request)
        {
    throw new System.NotImplementedException("TODO: Team Member 1 - Implement PublishNewTaskAsync in QuestionService.cs");
}
    }
}
