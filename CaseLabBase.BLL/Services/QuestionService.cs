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


        // Team Member 1 - Implement GetAllQuizzesAsync in QuestionService
        public async Task<List<QuizDTO>> GetAllQuizzesAsync()
        {

            // 1. Fetch the raw list of all quizzes from the Database using the Repository
            var list = await _questionRepository.GetQuizzesAsync();

            // 2. Map (convert) the database entities into QuizDTOs to send only the necessary data to the frontend
            return list.Select(q => new QuizDTO
            {
                Title = q.Title,
                TimeLimitMinutes = q.TimeLimitMinutes,
                IsQuizOpen = q.IsQuizOpen,
                IsForumOpen = q.IsForumOpen,
                DeadlineString = q.DeadlineString,
                PdfBase64 = q.PdfBase64,
                QuizMode = q.QuizMode,
                TotalScore = q.TotalScore
            }).ToList(); // Convert the mapped items back into a List and return it
        }

        //-------------------------------------------------------------------
        
        public async Task<List<QuestionDTO>> GetActiveQuestionsAsync(string quizTitle)
        {
    throw new System.NotImplementedException("TODO: Team Member 2 - Implement GetActiveQuestionsAsync in QuestionService.cs");
}




        //------------------------------------------------------------------
        //Team Member 1 - Implement PublishNewTaskAsync in QuestionService
        public async Task PublishNewTaskAsync(PublishTaskRequest request)
        {
            
            // 1. Validate: sum of question weights must equal total score
            decimal sumOfWeights = request.Questions.Sum(q => q.MaxScore);
            if (sumOfWeights != request.TotalScore)
            {
                throw new System.ArgumentException($"The sum of question scores ({sumOfWeights:0.00}) must equal the quiz total score ({request.TotalScore:0.00}).");
            }

            // 2. Create and add Quiz entity (will overwrite if exists)
            var quizEntity = new Quiz
            {
                Title = request.Title,
                TimeLimitMinutes = request.TimeLimitMinutes,
                IsQuizOpen = request.IsQuizOpen,
                IsForumOpen = request.IsForumOpen,
                DeadlineString = request.DeadlineString,
                PdfBase64 = request.PdfBase64,
                QuizMode = request.QuizMode,
                TotalScore = request.TotalScore
            };

            await _questionRepository.AddQuizAsync(quizEntity);

            // 3. Insert new questions for the quiz using Factory Pattern
            foreach (var q in request.Questions)
            {
                string? optionsJson = q.Options != null ? JsonSerializer.Serialize(q.Options) : null;
                var questionEntity = Factory.QuestionFactory.Create(q.Type, request.Title, q.Prompt, q.Topic, optionsJson, q.CorrectKey ?? "", q.MaxScore);
                await _questionRepository.AddAsync(questionEntity);
            }
            
}
    }
}
