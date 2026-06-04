using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLab.BLL.DTOs;
using CaseLab.DAL.Entities;
using CaseLab.DAL.Repositories;

namespace CaseLab.BLL.Services
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
            var activeQuestions = await _questionRepository.GetByQuizTitleAsync(quizTitle);
            int essayCount = activeQuestions.Count(q => q.Type == "Essay");
            bool hasEssay = essayCount > 0;

            // 1. Create or update a submission record for this student + quiz.
            //    SaveSubmissionAsync handles both INSERT (new) and UPDATE (re-submit) cases.
            //    After the call, submission.Id is guaranteed to be the real DB identity value.
            var submission = new Submission
            {
                StudentId = studentId,
                QuizTitle = quizTitle,
                Status = hasEssay ? "Pending" : "Graded",
                FinalScore = 0.00m,
                DisputeStatus = "None",
                SurveyPainPoint = "Awaiting reflection survey..."
            };
            await _submissionRepository.SaveSubmissionAsync(submission);
            // submission.Id is now the real PK (populated by EF Core on insert, or set by the repo on update)

            decimal initialScore = 0.00m;

            // 2. Save/overwrite answer rows using the real SubmissionId
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
                    answerEntity.IsCorrect = null;
                    answerEntity.TeacherTag = "Pending";
                    answerEntity.EarnedScore = 0.00m;
                }

                await _submissionRepository.SaveSubmissionAnswerAsync(answerEntity);
            }

            // 3. Persist the accumulated score back to the submission record
            submission.FinalScore = initialScore;
            await _submissionRepository.SaveSubmissionAsync(submission);
        }

        public async Task SubmitSurveyAsync(string studentId, string quizTitle, List<SubmitSurveyRequestItem> reflections)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null) return;

            string generalPainPoint = "No notes.";

            foreach (var refl in reflections)
            {
                var answer = submission.Answers.FirstOrDefault(a => a.QuestionId == refl.QuestionId);
                if (answer == null) continue;

                answer.Difficulty = refl.Difficulty;
                answer.CommentNote = refl.CommentNote;

                // If this is an essay question, use its note as the main pain point
                if (answer.Question.Type == "Essay" && !string.IsNullOrEmpty(refl.CommentNote))
                {
                    generalPainPoint = refl.CommentNote;
                }

                await _submissionRepository.SaveSubmissionAnswerAsync(answer);
            }

            submission.SurveyPainPoint = generalPainPoint;
            await _submissionRepository.SaveSubmissionAsync(submission);
        }

        public async Task<SubmissionDTO?> GetMistakeBankAsync(string studentId, string quizTitle)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null) return null;

            return new SubmissionDTO
            {
                StudentId = submission.StudentId,
                StudentName = submission.Student.Name,
                Status = submission.Status,
                FinalScore = submission.FinalScore,
                SurveyPainPoint = submission.SurveyPainPoint,
                DisputeStatus = submission.DisputeStatus,
                Answers = submission.Answers.Select(a => new SubmissionAnswerDTO
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
                    EarnedScore = a.EarnedScore
                }).ToList()
            };
        }

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
