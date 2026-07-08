using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.BLL.Observer;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;

namespace CaseLabBase.BLL.Services
{
    public class StudentService : ISubmissionSubject
    {
        private readonly SubmissionRepository _submissionRepository;
        private readonly QuestionRepository _questionRepository;
        private readonly ForumRepository _forumRepository;
        private readonly UserRepository _userRepository;
        private readonly List<ISubmissionObserver> _observers = new();

        public StudentService(
            SubmissionRepository submissionRepository,
            QuestionRepository questionRepository,
            ForumRepository forumRepository,
            UserRepository userRepository,
            IEnumerable<ISubmissionObserver> observers)
        {
            _submissionRepository = submissionRepository;
            _questionRepository = questionRepository;
            _forumRepository = forumRepository;
            _userRepository = userRepository;
            foreach (var observer in observers)
            {
                RegisterObserver(observer);
            }
        }

        public void RegisterObserver(ISubmissionObserver observer)
        {
            _observers.Add(observer);
        }

        public void RemoveObserver(ISubmissionObserver observer)
        {
            _observers.Remove(observer);
        }

        public async Task NotifyObserversAsync(Submission submission)
        {
            foreach (var observer in _observers)
            {
                await observer.OnSubmittedAsync(submission);
            }
        }

        //Team member 2: Kelly Implemented SubmitExamAsync in StudentService.cs
        public async Task SubmitExamAsync(string studentId, string quizTitle, List<SubmitAnswerRequestItem> answers)

        {
            var questions = await _questionRepository.GetByQuizTitleAsync(quizTitle);

            // Check if the quiz contains any essay questions to determine the grading status
            int essayCount = questions.Count(q => q.Type == "Essay");
            bool hasEssay = essayCount > 0;


            var submission = new Submission
            {
                StudentId = studentId,
                QuizTitle = quizTitle,
                Status = hasEssay ? "Pending" : "Graded", // Dynamically set status based on question types
                FinalScore = 0,
                DisputeStatus = "None",
                SurveyPainPoint = "Awaiting reflection survey..."
            };
            await _submissionRepository.SaveSubmissionAsync(submission);
            decimal totalScore = 0;

            foreach (var item in answers)
            {
                var question = questions.FirstOrDefault(q => q.Id == item.QuestionId);
                if (question == null)
                    continue;

                var submissionAnswer = new SubmissionAnswer
                {
                    SubmissionId = submission.Id,
                    QuestionId = question.Id,
                    StudentAnswer = item.StudentAnswer,
                    Difficulty = "Medium"
                   
                };

                // Separate logic for Multiple Choice Questions (MCQ) and Essay Questions
                if (question.Type == "MCQ")
                {
                    // Perform a safe case-insensitive string comparison with trimming
                    bool isCorrect = string.Equals(
                        item.StudentAnswer?.Trim(),
                        question.CorrectKey?.Trim(),
                        System.StringComparison.OrdinalIgnoreCase);

                    decimal earnedScore = isCorrect ? question.MaxScore : 0;
                    totalScore += earnedScore;

                    submissionAnswer.IsCorrect = isCorrect;
                    submissionAnswer.EarnedScore = earnedScore;
                    submissionAnswer.TeacherTag = "Auto-Graded";
                }
                else // Handles Essay questions that require manual grading by a teacher
                {
                    submissionAnswer.IsCorrect = null;
                    submissionAnswer.EarnedScore = 0;
                    submissionAnswer.TeacherTag = "Pending";
                }
       
               
                await _submissionRepository.SaveSubmissionAnswerAsync(submissionAnswer);
            }
            submission.FinalScore = totalScore;
            await _submissionRepository.SaveSubmissionAsync(submission);

            await NotifyObserversAsync(submission);
        } 
        

        public async Task SubmitSurveyAsync(string studentId, string quizTitle, List<SubmitSurveyRequestItem> reflections)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null)
                return;
            foreach (var reflection in reflections)
            {
                var answer = submission.Answers.FirstOrDefault(a => a.QuestionId == reflection.QuestionId);
                if (answer == null)
                    continue;

                answer.Difficulty = reflection.Difficulty;
                answer.CommentNote = reflection.CommentNote;
                await _submissionRepository.SaveSubmissionAnswerAsync(answer);
            }
        } //Team member 2: Kelly Implemented SubmitSurveyAsync in StudentService.cs

        public async Task<SubmissionDTO?> GetMistakeBankAsync(string studentId, string quizTitle)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null)
            {
                return null;
            }
            var submissionDTO = new SubmissionDTO
            {
                StudentId = submission.StudentId,
                StudentName = submission.Student.Name,
                Status = submission.Status,
                FinalScore = submission.FinalScore,
                SurveyPainPoint = submission.SurveyPainPoint,
                DisputeStatus = submission.DisputeStatus,
            };

            submissionDTO.Answers = submission.Answers
                .Where(a => a.IsCorrect == false) // Filter to include only incorrect answers
                .Select(a => new SubmissionAnswerDTO
                {
                    QuestionId = a.QuestionId,
                    QuestionPrompt = a.Question.Prompt,
                    QuestionTopic = a.Question.Topic,
                    QuestionType = a.Question.Type,
                    StudentAnswer = a.StudentAnswer,
                    IsCorrect = a.IsCorrect,
                    TeacherTag = a.TeacherTag,
                    Difficulty = a.Difficulty,
                    CommentNote = a.CommentNote,
                    MaxScore = a.Question.MaxScore,
                    EarnedScore = a.EarnedScore,
                    EasyRate = 0,
                    MediumRate = 0,
                    HardRate = 0
                })
                .ToList();
            return submissionDTO;
        } //Team member 2: Kelly Implemented GetMistakeBankAsync in StudentService.cs

        public async Task InitiateDisputeAsync(string studentId, int questionId, string reason)
        {
    throw new System.NotImplementedException("TODO: Team Member 5 - Implement InitiateDisputeAsync in StudentService.cs");
}
    }
}
