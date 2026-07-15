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
                MaxScore = q.MaxScore,
                MarkingGuide = q.MarkingGuide
            }).ToList();
        }




        //------------------------------------------------------------------
        //Member 1- Han: Implement PublishNewTaskAsync in QuestionService
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
        public async Task UpdateQuestionAsync(UpdateQuestionRequest request)
        {
            var q = await _questionRepository.GetByIdAsync(request.Id);
            if (q == null) return;

            string? oldCorrectKey = q.CorrectKey;
            string? optionsJson = request.Options != null ? JsonSerializer.Serialize(request.Options) : null;

            q.Prompt = request.Prompt;
            q.Topic = request.Topic;
            q.Options = optionsJson;
            q.CorrectKey = request.CorrectKey ?? "";
            q.MaxScore = request.MaxScore;
            q.MarkingGuide = request.MarkingGuide;

            await _questionRepository.UpdateAsync(q);

            // If MCQ and key changed, trigger re-grading
            if (q.Type == "MCQ" && oldCorrectKey != request.CorrectKey)
            {
                // Re-grade submissions for this MCQ in this specific quiz
                var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(q.QuizTitle);
                foreach (var s in submissions)
                {
                    var mcqAnswer = s.Answers.FirstOrDefault(a => a.QuestionId == q.Id);
                    if (mcqAnswer != null)
                    {
                        mcqAnswer.IsCorrect = (mcqAnswer.StudentAnswer == request.CorrectKey);
                        mcqAnswer.EarnedScore = mcqAnswer.IsCorrect == true ? q.MaxScore : 0.00m;
                        await _submissionRepository.SaveSubmissionAnswerAsync(mcqAnswer);

                        // Re-calculate final score based on new correctness
                        s.FinalScore = s.Answers.Sum(a => a.EarnedScore);
                        await _submissionRepository.SaveSubmissionAsync(s);
                    }
                }
            }
        }

        public async Task UpdateQuizSettingsAsync(UpdateQuizSettingsRequest request)
        {
            var quiz = await _questionRepository.GetQuizByTitleAsync(request.Title);
            if (quiz != null)
            {
                quiz.TimeLimitMinutes = request.TimeLimitMinutes;
                quiz.IsQuizOpen = request.IsQuizOpen;
                quiz.IsForumOpen = request.IsForumOpen;
                quiz.DeadlineString = request.DeadlineString;
                await _questionRepository.UpdateQuizAsync(quiz);
            }
        }


    }
}
