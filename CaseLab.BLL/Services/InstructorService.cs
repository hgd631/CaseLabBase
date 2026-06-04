using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLab.BLL.DTOs;
using CaseLab.DAL.Entities;
using CaseLab.DAL.Repositories;

namespace CaseLab.BLL.Services
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
            var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(quizTitle);
            int total = submissions.Count;
            int graded = submissions.Count(s => s.Status == "Graded");

            var quiz = await _questionRepository.GetQuizByTitleAsync(quizTitle);
            decimal totalScore = quiz?.TotalScore ?? 10.00m;

            // Calculate defect rate (score < 80% of total score)
            decimal defectRate = 0;
            if (graded > 0)
            {
                int failed = submissions.Count(s => s.Status == "Graded" && s.FinalScore < 0.80m * totalScore);
                defectRate = ((decimal)failed / graded) * 100;
            }

            decimal avg = 0;
            if (submissions.Count > 0)
            {
                avg = submissions.Average(s => s.FinalScore);
            }

            return new ClassAnalyticsDTO
            {
                ActiveTaskTitle = quizTitle,
                TotalSubmissionsCount = total,
                GradedCount = graded,
                FailureRatePercentage = Math.Round(defectRate, 1),
                ClassAverageScore = Math.Round(avg, 1)
            };
        }

        public async Task<List<SubmissionDTO>> GetRosterSubTabAsync(string subTab, string quizTitle)
        {
            var all = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(quizTitle);
            IEnumerable<Submission> filtered = all;

            if (subTab == "pending")
            {
                filtered = all.Where(s => s.Status == "Pending" && s.DisputeStatus != "PendingReview");
            }
            else if (subTab == "graded")
            {
                filtered = all.Where(s => s.Status == "Graded" && s.DisputeStatus != "PendingReview");
            }
            else if (subTab == "dispute")
            {
                filtered = all.Where(s => s.DisputeStatus == "PendingReview");
            }

            var tickets = await _forumRepository.GetAllTicketsAsync();

            // Calculate difficulty statistics for each question based on ALL submissions for this quiz
            var allAnswersForQuiz = all.SelectMany(s => s.Answers).ToList();
            var questionStats = allAnswersForQuiz
                .GroupBy(a => a.QuestionId)
                .ToDictionary(
                    g => g.Key,
                    g => {
                        var answersWithDifficulty = g.Where(a => !string.IsNullOrEmpty(a.Difficulty)).ToList();
                        int total = answersWithDifficulty.Count;
                        int easy = answersWithDifficulty.Count(a => a.Difficulty == "Easy");
                        int medium = answersWithDifficulty.Count(a => a.Difficulty == "Medium");
                        int hard = answersWithDifficulty.Count(a => a.Difficulty == "Hard");

                        decimal easyRate = total > 0 ? ((decimal)easy / total) * 100m : 0m;
                        decimal mediumRate = total > 0 ? ((decimal)medium / total) * 100m : 0m;
                        decimal hardRate = total > 0 ? ((decimal)hard / total) * 100m : 0m;

                        return new { 
                            EasyRate = Math.Round(easyRate, 1), 
                            MediumRate = Math.Round(mediumRate, 1), 
                            HardRate = Math.Round(hardRate, 1) 
                        };
                    }
                );

            return filtered.Select(s => {
                var dto = new SubmissionDTO
                {
                    StudentId = s.StudentId,
                    StudentName = s.Student.Name,
                    Status = s.Status,
                    FinalScore = s.FinalScore,
                    SurveyPainPoint = s.SurveyPainPoint,
                    DisputeStatus = s.DisputeStatus,
                    Answers = s.Answers.Select(a => {
                        var stats = questionStats.ContainsKey(a.QuestionId) 
                            ? questionStats[a.QuestionId] 
                            : new { EasyRate = 0m, MediumRate = 0m, HardRate = 0m };

                        return new SubmissionAnswerDTO
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
                            EasyRate = stats.EasyRate,
                            MediumRate = stats.MediumRate,
                            HardRate = stats.HardRate
                        };
                    }).ToList()
                };

                // For dispute tab, override SurveyPainPoint display text with live ticket reason
                if (subTab == "dispute")
                {
                    var ticket = tickets.FirstOrDefault(t => t.StudentId == s.StudentId && t.Status == "Pending" && s.Answers.Any(a => a.QuestionId == t.QuestionId));
                    if (ticket != null)
                    {
                        dto.SurveyPainPoint = $"\"{ticket.Msg}\"";
                    }
                }
                else if (subTab == "graded")
                {
                    dto.SurveyPainPoint = "Medium Complexity Verified Index";
                }

                return dto;
            }).ToList();
        }

        public async Task GradeSubmissionAsync(string studentId, string quizTitle, List<GradeQuestionItem> grades)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null) return;

            submission.Status = "Graded";

            foreach (var answer in submission.Answers)
            {
                var gradeItem = grades.FirstOrDefault(g => g.QuestionId == answer.QuestionId);
                if (gradeItem != null)
                {
                    answer.EarnedScore = gradeItem.EarnedScore;

                    if (answer.Question.Type == "Essay")
                    {
                        if (!string.IsNullOrEmpty(gradeItem.ChosenTag))
                        {
                            answer.IsCorrect = false;
                            answer.TeacherTag = gradeItem.ChosenTag;
                        }
                        else
                        {
                            answer.IsCorrect = true;
                            answer.TeacherTag = "Passed Evaluation Checklist";
                        }
                    }
                    await _submissionRepository.SaveSubmissionAnswerAsync(answer);
                }
            }

            submission.FinalScore = submission.Answers.Sum(a => a.EarnedScore);
            await _submissionRepository.SaveSubmissionAsync(submission);
        }

        public async Task ResolveDisputeAsync(string studentId, string quizTitle, int questionId, bool isApproved, decimal manualOverrideScore)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            var ticket = await _forumRepository.GetTicketAsync(studentId, questionId);
            if (submission == null || ticket == null) return;

            var essayAnswer = submission.Answers.FirstOrDefault(a => a.QuestionId == questionId);

            if (isApproved)
            {
                if (essayAnswer != null)
                {
                    essayAnswer.EarnedScore = manualOverrideScore;
                    if (manualOverrideScore >= 0.80m * essayAnswer.Question.MaxScore)
                    {
                        essayAnswer.IsCorrect = true;
                        essayAnswer.TeacherTag = "Passed Framework Checklist via Manual Override Revision";
                    }
                    else
                    {
                        essayAnswer.TeacherTag = $"Partial Credit Granted: Adjusted to {manualOverrideScore} pts";
                    }
                    await _submissionRepository.SaveSubmissionAnswerAsync(essayAnswer);
                }

                submission.FinalScore = submission.Answers.Sum(a => a.EarnedScore);
                submission.DisputeStatus = "Resolved_Accepted";
                ticket.Status = "Accepted";

                var comment = new Comment
                {
                    IsPrivate = true,
                    StudentId = studentId,
                    Topic = "Dispute Q" + questionId,
                    Sender = "Dr. Ali Bayeh (Instructor)",
                    Message = $"🟢 [Dispute Resolved]: Evaluation audited manually. Variable point score overridden at: {manualOverrideScore} / {(essayAnswer?.Question.MaxScore ?? 0.00m)} pts.",
                    Timestamp = DateTime.Now
                };
                await _forumRepository.AddCommentAsync(comment);
            }
            else
            {
                submission.DisputeStatus = "Resolved_Rejected";
                ticket.Status = "Rejected";

                var comment = new Comment
                {
                    IsPrivate = true,
                    StudentId = studentId,
                    Topic = "Dispute Q" + questionId,
                    Sender = "Dr. Ali Bayeh (Instructor)",
                    Message = "❌ [Dispute Concluding]: Initial evaluation parameters sustained.",
                    Timestamp = DateTime.Now
                };
                await _forumRepository.AddCommentAsync(comment);
            }

            await _submissionRepository.SaveSubmissionAsync(submission);
            await _forumRepository.SaveTicketAsync(ticket);
        }

        public async Task<List<string>> GetErrorTagsAsync()
        {
            var list = await _submissionRepository.GetErrorTagsAsync();
            return list.Select(t => t.Tag).ToList();
        }

        public async Task AddErrorTagAsync(string tag)
        {
            await _submissionRepository.AddErrorTagAsync(new ErrorTag { Tag = tag });
        }

        public async Task UpdateAnswerKeyAsync(int questionId, string correctKey)
        {
            var q = await _questionRepository.GetByIdAsync(questionId);
            if (q == null) return;

            q.CorrectKey = correctKey;
            await _questionRepository.UpdateAsync(q);

            // Re-grade submissions for this MCQ in this specific quiz
            var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(q.QuizTitle);
            foreach (var s in submissions)
            {
                var mcqAnswer = s.Answers.FirstOrDefault(a => a.QuestionId == questionId);
                if (mcqAnswer != null)
                {
                    mcqAnswer.IsCorrect = (mcqAnswer.StudentAnswer == correctKey);
                    if (mcqAnswer.IsCorrect == true)
                    {
                        mcqAnswer.EarnedScore = q.MaxScore;
                    }
                    else
                    {
                        mcqAnswer.EarnedScore = 0.00m;
                    }
                    await _submissionRepository.SaveSubmissionAnswerAsync(mcqAnswer);

                    // Re-calculate final score based on new correctness
                    s.FinalScore = s.Answers.Sum(a => a.EarnedScore);
                    await _submissionRepository.SaveSubmissionAsync(s);
                }
            }
        }
    }
}
