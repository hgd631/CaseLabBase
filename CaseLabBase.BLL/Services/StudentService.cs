using CaseLabBase.BLL.DTOs;
using CaseLabBase.BLL.Observer;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace CaseLabBase.BLL.Services
{
    // Implementation of Observer Pattern (Subject)

    //Observer Pattern: StudentService acts as the Subject that notifies registered observers (e.g., TeacherNotificationService) when a student submits an exam.
    public class StudentService : ISubmissionSubject
    {
        private readonly SubmissionRepository _submissionRepository;
        private readonly QuestionRepository _questionRepository;
        private readonly ForumRepository _forumRepository;
        private readonly UserRepository _userRepository;

        // List to hold all registered observers (e.g., Notification system)
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

            // Automatically register all observers found in the system
            foreach (var observer in observers)
            {
                RegisterObserver(observer);
            }
        }

        #region Observer Pattern Methods
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
        #endregion

        // Processes the exam submission
        public async Task SubmitExamAsync(string studentId, string quizTitle, List<SubmitAnswerRequestItem> answers)
        {
            var activeQuestions = await _questionRepository.GetByQuizTitleAsync(quizTitle);
            bool hasEssay = activeQuestions.Any(q => q.Type == "Essay");

            // Create the initial submission record
            var submission = new Submission
            {
                StudentId = studentId,
                QuizTitle = quizTitle,
                Status = hasEssay ? "Pending" : "Graded", // Essays require manual teacher grading
                FinalScore = 0.00m,
                SurveyPainPoint = "Awaiting reflection survey..."
            };

            await _submissionRepository.SaveSubmissionAsync(submission);

            decimal initialScore = 0.00m;

            // Process each student answer
            foreach (var answerItem in answers)
            {
                var question = activeQuestions.FirstOrDefault(q => q.Id == answerItem.QuestionId);
                if (question == null) continue;

                var answerEntity = new SubmissionAnswer
                {
                    SubmissionId = submission.Id,
                    QuestionId = answerItem.QuestionId,
                    StudentAnswer = answerItem.StudentAnswer,
                    Difficulty = "Medium"
                };

                // Logic for automatic MCQ grading
                if (question.Type == "MCQ")
                {
                    bool isCorrect = (answerItem.StudentAnswer == question.CorrectKey);
                    answerEntity.IsCorrect = isCorrect;
                    answerEntity.TeacherTag = "Auto-Graded";
                    answerEntity.EarnedScore = isCorrect ? question.MaxScore : 0.00m;
                    if (isCorrect) initialScore += question.MaxScore;
                }
                else
                {
                    // Essay questions stay pending for teacher evaluation
                    answerEntity.IsCorrect = null;
                    answerEntity.TeacherTag = "Pending";
                    answerEntity.EarnedScore = 0.00m;
                }

                await _submissionRepository.SaveSubmissionAnswerAsync(answerEntity);
            }

            // Update final score and notify observers (Pattern Trigger)
            submission.FinalScore = initialScore;
            await _submissionRepository.SaveSubmissionAsync(submission);

            // Trigger the Observer Pattern to notify Teachers
            await NotifyObserversAsync(submission);
        }

        // Updates student reflection survey data
        public async Task SubmitSurveyAsync(string studentId, string quizTitle, string difficulty, string? commentNote)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null) return;

            submission.SurveyDifficulty = difficulty;
            submission.SurveyPainPoint = string.IsNullOrWhiteSpace(commentNote) ? "No notes." : commentNote;

            await _submissionRepository.SaveSubmissionAsync(submission);
        }

        // Retrieves graded results and mistakes for the student
        public async Task<SubmissionDTO?> GetMistakeBankAsync(string studentId, string quizTitle)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null) return null;

            decimal actualTotalQuizScore = submission.Answers.Sum(a => a.Question.MaxScore);

            return new SubmissionDTO
            {
                StudentId = submission.StudentId,
                StudentName = submission.Student.Name,
                Status = submission.Status,
                FinalScore = submission.FinalScore,
                QuizMaxScore = actualTotalQuizScore,
                SurveyDifficulty = submission.SurveyDifficulty,
                SurveyPainPoint = submission.SurveyPainPoint,
                Answers = submission.Answers.Select(a =>
                {
                    var optionsList = string.IsNullOrEmpty(a.Question.Options)
                        ? new List<string>()
                        : System.Text.Json.JsonSerializer.Deserialize<List<string>>(a.Question.Options);

                   
                    var fullCorrectAnswer = optionsList?.FirstOrDefault(o => o.Trim().StartsWith(a.Question.CorrectKey))
                                            ?? a.Question.CorrectKey;

                    return new SubmissionAnswerDTO
                    {
                        QuestionId = a.QuestionId,
                        QuestionPrompt = a.Question.Prompt,
                        QuestionTopic = a.Question.Topic,
                        QuestionType = a.Question.Type,
                        StudentAnswer = a.StudentAnswer,
                        IsCorrect = a.IsCorrect,
                        TeacherTag = a.TeacherTag,
                        TeacherFeedback = a.TeacherFeedback,
                        MaxScore = a.Question.MaxScore,
                        EarnedScore = a.EarnedScore,
                      
                        CorrectAnswer = fullCorrectAnswer
                    };
                }).ToList()
            };
        }
    }
}