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

        public async Task SubmitExamAsync(string studentId, string quizTitle, List<SubmitAnswerRequestItem> answers)
        {
    throw new System.NotImplementedException("TODO: Team Member 2 - Implement SubmitExamAsync in StudentService.cs");
}

        public async Task SubmitSurveyAsync(string studentId, string quizTitle, List<SubmitSurveyRequestItem> reflections)
        {
    throw new System.NotImplementedException("TODO: Team Member 2 - Implement SubmitSurveyAsync in StudentService.cs");
}

        public async Task<SubmissionDTO?> GetMistakeBankAsync(string studentId, string quizTitle)
        {
    throw new System.NotImplementedException("TODO: Team Member 2 - Implement GetMistakeBankAsync in StudentService.cs");
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
    }
}
