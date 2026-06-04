using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;

namespace CaseLabBase.BLL.Services
{
    public class InstructorService
    {
        private readonly SubmissionRepository _submissionRepository;
        private readonly QuestionRepository _questionRepository;
        private readonly ForumRepository _forumRepository;

        public InstructorService(
            SubmissionRepository submissionRepository,
            QuestionRepository questionRepository,
            ForumRepository forumRepository)
        {
            _submissionRepository = submissionRepository;
            _questionRepository = questionRepository;
            _forumRepository = forumRepository;
        }

        public async Task<ClassAnalyticsDTO> GetClassAnalyticsAsync(string quizTitle)
        {
    throw new System.NotImplementedException("TODO: Team Member 3 - Implement GetClassAnalyticsAsync in InstructorService.cs");
}

        public async Task<List<SubmissionDTO>> GetRosterSubTabAsync(string subTab, string quizTitle)
        {
    throw new System.NotImplementedException("TODO: Team Member 3 - Implement GetRosterSubTabAsync in InstructorService.cs");
}

        public async Task GradeSubmissionAsync(string studentId, string quizTitle, List<GradeQuestionItem> grades)
        {
    throw new System.NotImplementedException("TODO: Team Member 4 - Implement GradeSubmissionAsync in InstructorService.cs");
}

        public async Task ResolveDisputeAsync(string studentId, string quizTitle, int questionId, bool isApproved, decimal manualOverrideScore)
        {
    throw new System.NotImplementedException("TODO: Team Member 5 - Implement ResolveDisputeAsync in InstructorService.cs");
}

        public async Task<List<string>> GetErrorTagsAsync()
        {
    throw new System.NotImplementedException("TODO: Team Member 4 - Implement GetErrorTagsAsync in InstructorService.cs");
}

        public async Task AddErrorTagAsync(string tag)
        {
    throw new System.NotImplementedException("TODO: Team Member 4 - Implement AddErrorTagAsync in InstructorService.cs");
}

        public async Task UpdateAnswerKeyAsync(int questionId, string correctKey)
        {
    throw new System.NotImplementedException("TODO: Team Member 4 - Implement UpdateAnswerKeyAsync in InstructorService.cs");
}
    }
}
