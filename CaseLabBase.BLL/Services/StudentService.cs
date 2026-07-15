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

        //Team member 2: Kelly Implemented SubmitSurveyAsync in StudentService.cs
        public async Task SubmitSurveyAsync(string studentId, string quizTitle, List<SubmitSurveyRequestItem> reflections)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null)
                return;

            // adding a default value for SurveyPainPoint in case no reflections are provided
            string generalPainPoint = "No notes.";
            foreach (var reflection in reflections)
            {
                var answer = submission.Answers.FirstOrDefault(a => a.QuestionId == reflection.QuestionId);
                if (answer == null)
                    continue;

                answer.Difficulty = reflection.Difficulty;
                answer.CommentNote = reflection.CommentNote;


                // If this is an essay question, use its note as the main pain point
                if (answer.Question.Type == "Essay" && !string.IsNullOrEmpty(reflection.CommentNote))
                {
                    generalPainPoint = reflection.CommentNote;
                }


                await _submissionRepository.SaveSubmissionAnswerAsync(answer);
            }

            // Update the submission's SurveyPainPoint with the general pain point derived from essay reflections
            submission.SurveyPainPoint = generalPainPoint;
            await _submissionRepository.SaveSubmissionAsync(submission);
        } 


        //Team member 2: Kelly Implemented GetMistakeBankAsync in StudentService.cs
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
                     
                })
                .ToList();
            return submissionDTO;
        } 

        // Member Han - Implement InitiateDisputeAsync in StudentService
        public async Task InitiateDisputeAsync(string studentId, int questionId, string reason)
        {

            var question = await _questionRepository.GetByIdAsync(questionId);
            if (question == null) return;

            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, question.QuizTitle);
            var studentUser = await _userRepository.GetByIdAsync(studentId);
            if (submission == null || studentUser == null) return;

            // 1. Mutate dispute status
            submission.DisputeStatus = "PendingReview";
            await _submissionRepository.SaveSubmissionAsync(submission);

            // 2. Open dispute ticket
            var ticket = new Ticket
            {
                StudentId = studentId,
                QuestionId = questionId,
                Msg = reason,
                Status = "Pending"
            };
            await _forumRepository.SaveTicketAsync(ticket);

            // 3. Log private thread starting comment
            var startComment = new Comment
            {
                IsPrivate = true,
                StudentId = studentId,
                Topic = "Dispute Q" + questionId,
                Sender = $"{studentUser.Name} (Student)",
                Message = "🚨 [Dispute Opened]: " + reason,
                Timestamp = System.DateTime.Now
            };
            await _forumRepository.AddCommentAsync(startComment);
            
}



        public async Task InitiateSubmissionDisputeAsync(string studentId, string quizTitle, string reason)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            var studentUser = await _userRepository.GetByIdAsync(studentId);
            if (submission == null || studentUser == null) return;

            // 1. Mutate dispute status
            submission.DisputeStatus = "PendingReview";
            await _submissionRepository.SaveSubmissionAsync(submission);

            // 2. Open dispute ticket mapping to first question (to satisfy schema FK)
            var questions = await _questionRepository.GetByQuizTitleAsync(quizTitle);
            var firstQuestion = questions.FirstOrDefault();
            int questionId = firstQuestion?.Id ?? 0;

            if (questionId > 0)
            {
                var ticket = new Ticket
                {
                    StudentId = studentId,
                    QuestionId = questionId,
                    Msg = reason,
                    Status = "Pending"
                };
                await _forumRepository.SaveTicketAsync(ticket);
            }

            // 3. Log private thread starting comment
            var startComment = new Comment
            {
                IsPrivate = true,
                StudentId = studentId,
                Topic = "Dispute " + studentId + " - " + quizTitle,
                Sender = $"{studentUser.Name} (Student)",
                Message = "🚨 [Submission Dispute Opened]: " + reason,
                Timestamp = System.DateTime.Now
            };
            await _forumRepository.AddCommentAsync(startComment);
        }

    }
}
