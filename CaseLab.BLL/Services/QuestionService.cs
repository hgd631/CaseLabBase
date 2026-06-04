using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using CaseLab.BLL.DTOs;
using CaseLab.DAL.Entities;
using CaseLab.DAL.Repositories;

namespace CaseLab.BLL.Services
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
            var list = await _questionRepository.GetQuizzesAsync();
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
            }).ToList();
        }

        public async Task<List<QuestionDTO>> GetActiveQuestionsAsync(string quizTitle)
        {
            var list = await _questionRepository.GetByQuizTitleAsync(quizTitle);
            return list.Select(q => new QuestionDTO
            {
                Id = q.Id,
                Type = q.Type,
                Topic = q.Topic,
                Prompt = q.Prompt,
                Options = !string.IsNullOrEmpty(q.Options) 
                    ? JsonSerializer.Deserialize<List<string>>(q.Options) 
                    : null,
                CorrectKey = q.CorrectKey,
                MaxScore = q.MaxScore
            }).ToList();
        }

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

            // 3. Insert new questions for the quiz
            foreach (var q in request.Questions)
            {
                var questionEntity = new Question
                {
                    QuizTitle = request.Title,
                    Type = q.Type,
                    Topic = string.IsNullOrWhiteSpace(q.Topic) ? "General" : q.Topic,
                    Prompt = q.Prompt,
                    Options = q.Options != null ? JsonSerializer.Serialize(q.Options) : null,
                    CorrectKey = q.CorrectKey,
                    MaxScore = q.MaxScore
                };
                await _questionRepository.AddAsync(questionEntity);
            }
        }
    }
}
