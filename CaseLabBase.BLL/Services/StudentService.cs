using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;

namespace CaseLabBase.BLL.Services
{
    public class StudentService
    {
        private readonly SubmissionRepository _submissionRepository;
        private readonly QuestionRepository _questionRepository;
        private readonly ForumRepository _forumRepository;
        private readonly UserRepository _userRepository;

        public StudentService(
            SubmissionRepository submissionRepository,
            QuestionRepository questionRepository,
            ForumRepository forumRepository,
            UserRepository userRepository)
        {
            _submissionRepository = submissionRepository;
            _questionRepository = questionRepository;
            _forumRepository = forumRepository;
            _userRepository = userRepository;
        }

        public async Task SubmitExamAsync(string studentId, string quizTitle, List<SubmitAnswerRequestItem> answers)
        {
    throw new System.NotImplementedException("TODO: Team Member 2 - Implement SubmitExamAsync in StudentService.cs");
}

        public async Task SubmitSurveyAsync(string studentId, string quizTitle, List<SubmitSurveyRequestItem> reflections)
        {
    throw new System.NotImplementedException("TODO: Team Member 3 - Implement SubmitSurveyAsync in StudentService.cs");
}

        public async Task<SubmissionDTO?> GetMistakeBankAsync(string studentId, string quizTitle)
        {
    throw new System.NotImplementedException("TODO: Team Member 2 - Implement GetMistakeBankAsync in StudentService.cs");
}

        public async Task InitiateDisputeAsync(string studentId, int questionId, string reason)
        {
    throw new System.NotImplementedException("TODO: Team Member 5 - Implement InitiateDisputeAsync in StudentService.cs");
}
    }
}
