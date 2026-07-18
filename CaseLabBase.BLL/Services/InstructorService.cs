using CaseLabBase.BLL.DTOs;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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

        // TODO:Hitesh - Implement GetClassAnalyticsAsync
        // fixed by Han
        public async Task<ClassAnalyticsDTO> GetClassAnalyticsAsync(string quizTitle)
        {
            var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(quizTitle);
            int total = submissions.Count;
            int graded = submissions.Count(s => s.Status == "Graded");

            var quiz = await _questionRepository.GetQuizByTitleAsync(quizTitle);
            decimal totalScore = quiz?.TotalScore ?? 10.00m;

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

        // TODO: Hitesh - Implement GetRosterSubTabAsync in InstructorService.cs
        // Fixed Han to support custom reflection analysis
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

                        return new
                        {
                            EasyRate = Math.Round(easyRate, 1),
                            MediumRate = Math.Round(mediumRate, 1),
                            HardRate = Math.Round(hardRate, 1)
                        };
                    }
                );

            var quiz = await _questionRepository.GetQuizByTitleAsync(quizTitle);
            decimal totalScore = quiz?.TotalScore ?? 10.00m;

            return filtered.Select(s => {
                var dto = new SubmissionDTO
                {
                    StudentId = s.StudentId,
                    StudentName = s.Student.Name,
                    Status = s.Status,
                    FinalScore = s.FinalScore,
                    SurveyDifficulty = s.SurveyDifficulty,
                    SurveyPainPoint = s.SurveyPainPoint,
                    
                    IsFlagged = (s.SurveyDifficulty == "Hard" && s.FinalScore >= 0.80m * totalScore),
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
                            HardRate = stats.HardRate,
                            MarkingGuide = a.Question.MarkingGuide,
                            TeacherFeedback = a.TeacherFeedback
                        };
                    }).ToList()
                };

                if (subTab == "dispute")
                {
                    var ticket = tickets.FirstOrDefault(t => t.StudentId == s.StudentId && t.Status == "Pending" && s.Answers.Any(a => a.QuestionId == t.QuestionId));
                    if (ticket != null)
                    {
                        dto.SurveyPainPoint = "${ticket.Msg}";
                    }
                }

                return dto;
            }).ToList();
        }

        // TODO: Soni - Implement GradeSubmissionAsync in InstructorService.cs
        // Refactored and fixed by Han
        public async Task GradeSubmissionAsync(string studentId, string quizTitle, List<GradeQuestionItem> grades)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);

            if (submission == null)
            {
                throw new ArgumentException($"Submission not found for Student '{studentId}' and Quiz '{quizTitle}'.");
            }

            submission.Status = "Graded";

            foreach (var answer in submission.Answers)
            {
                var gradeItem = grades.FirstOrDefault(g => g.QuestionId == answer.QuestionId);
                if (gradeItem != null)
                {
                    answer.EarnedScore = gradeItem.EarnedScore;
                    answer.TeacherFeedback = gradeItem.TeacherFeedback;
                    if (answer.Question.Type == "Essay")
                    {
                        answer.TeacherTag = !string.IsNullOrEmpty(gradeItem.ChosenTag) ? gradeItem.ChosenTag : "Graded";

                        if (gradeItem.EarnedScore == answer.Question.MaxScore)
                        {
                            answer.IsCorrect = true; 
                        }
                        else
                        {
                            answer.IsCorrect = false; 
                        }
                    }
                    await _submissionRepository.SaveSubmissionAnswerAsync(answer);
                }
            }

            submission.FinalScore = submission.Answers.Sum(a => a.EarnedScore);
            await _submissionRepository.SaveSubmissionAsync(submission);
        }

        

        // TODO: Soni - Implement GetErrorTagsAsync
        // fixed by Han
        public async Task<List<string>> GetErrorTagsAsync()
        {
            var list = await _submissionRepository.GetErrorTagsAsync();
            return list.Select(t => t.Tag).ToList();
        }

        // Updated by Han
        public async Task AddErrorTagAsync(string tag)
        {
            await _submissionRepository.AddErrorTagAsync(new ErrorTag { Tag = tag });
        }

        // TODO: Soni - Implement UpdateAnswerKeyAsync
        // fixed by Han 
        public async Task UpdateAnswerKeyAsync(int questionId, string correctKey)
        {
            var q = await _questionRepository.GetByIdAsync(questionId);
            if (q == null) return;

            q.CorrectKey = correctKey;
            await _questionRepository.UpdateAsync(q);

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

                    s.FinalScore = s.Answers.Sum(a => a.EarnedScore);
                    await _submissionRepository.SaveSubmissionAsync(s);
                }
            }
        }

        // Han - Implement RenameErrorTagAsync
        public async Task RenameErrorTagAsync(string oldTag, string newTag)
        {
            await _submissionRepository.RenameErrorTagAsync(oldTag, newTag);
        }
    }
}
