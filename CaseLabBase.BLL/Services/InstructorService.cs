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

        // Hitesh - Implement GetClassAnalyticsAsync
        // Updated by Han
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

            decimal avg = submissions.Count > 0 ? submissions.Average(s => s.FinalScore) : 0;

            return new ClassAnalyticsDTO
            {
                ActiveTaskTitle = quizTitle,
                TotalSubmissionsCount = total,
                GradedCount = graded,
                FailureRatePercentage = Math.Round(defectRate, 1),
                ClassAverageScore = Math.Round(avg, 1)
            };
        }

        // Hitesh - Implement GetRosterSubTabAsync in InstructorService.cs
        // Updated by Han to support custom reflection analysis
        public async Task<List<SubmissionDTO>> GetRosterSubTabAsync(string subTab, string quizTitle)
        {
            var all = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(quizTitle);
            IEnumerable<Submission> filtered = all;


            if (subTab == "pending")
            {
                filtered = all.Where(s => s.Status == "Pending");
            }
            else if (subTab == "graded")
            {
                filtered = all.Where(s => s.Status == "Graded");
            }

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

                        return new
                        {
                            EasyRate = total > 0 ? Math.Round(((decimal)easy / total) * 100m, 1) : 0m,
                            MediumRate = total > 0 ? Math.Round(((decimal)medium / total) * 100m, 1) : 0m,
                            HardRate = total > 0 ? Math.Round(((decimal)hard / total) * 100m, 1) : 0m
                        };
                    }
                );

            var quiz = await _questionRepository.GetQuizByTitleAsync(quizTitle);
            decimal totalScore = quiz?.TotalScore ?? 10.00m;

            return filtered.Select(s => new SubmissionDTO
            {
                StudentId = s.StudentId,
                StudentName = s.Student.Name,
                Status = s.Status,
                FinalScore = s.FinalScore,
                SurveyDifficulty = s.SurveyDifficulty,
                SurveyPainPoint = s.SurveyPainPoint,
                IsFlagged = (s.SurveyDifficulty == "Hard" && s.FinalScore >= 0.80m * totalScore),
                Answers = s.Answers.Select(a => {
                    var stats = questionStats.ContainsKey(a.QuestionId) ? questionStats[a.QuestionId] : new { EasyRate = 0m, MediumRate = 0m, HardRate = 0m };
                    return new SubmissionAnswerDTO
                    {
                        QuestionId = a.QuestionId,
                        QuestionPrompt = a.Question.Prompt,
                        QuestionTopic = a.Question.Topic,
                        QuestionType = a.Question.Type,
                        StudentAnswer = a.StudentAnswer,
                        IsCorrect = a.IsCorrect,
                        TeacherTag = a.TeacherTag,
                        EarnedScore = a.EarnedScore,
                        EasyRate = stats.EasyRate,
                        MediumRate = stats.MediumRate,
                        HardRate = stats.HardRate,
                        TeacherFeedback = a.TeacherFeedback
                    };
                }).ToList()
            }).ToList();
        }

        // Soni - Implement GradeSubmissionAsync in InstructorService.cs
        // Refactored and fixed by Han
        public async Task GradeSubmissionAsync(string studentId, string quizTitle, List<GradeQuestionItem> grades)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);

            if (submission == null)
            {
                throw new ArgumentException("Submission not found.");
            }

            submission.Status = "Graded";

            foreach (var answer in submission.Answers)
            {
                var gradeItem = grades.FirstOrDefault(g => g.QuestionId == answer.QuestionId);
                if (gradeItem != null)
                {
                    //  If instructor gives more points than MaxScore, cap it at MaxScore.
                    // This prevents getting 11/10 points.
                    decimal finalPoints = gradeItem.EarnedScore;
                    if (finalPoints > answer.Question.MaxScore)
                    {
                        finalPoints = answer.Question.MaxScore;
                    }

                    answer.EarnedScore = finalPoints;
                    answer.TeacherFeedback = gradeItem.TeacherFeedback;

                    if (answer.Question.Type == "Essay")
                    {
                        answer.TeacherTag = !string.IsNullOrEmpty(gradeItem.ChosenTag) ? gradeItem.ChosenTag : "Graded";
                        // Student gets IsCorrect=true only if they reach the absolute Max Score
                        answer.IsCorrect = (answer.EarnedScore == answer.Question.MaxScore);
                    }
                    await _submissionRepository.SaveSubmissionAnswerAsync(answer);
                }
            }

            submission.FinalScore = submission.Answers.Sum(a => a.EarnedScore);
            await _submissionRepository.SaveSubmissionAsync(submission);
        }

        // Soni - Implement GetErrorTagsAsync
        // Updated by Han
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

        // Soni - Implement UpdateAnswerKeyAsync
        // Fixed by Han
        public async Task UpdateAnswerKeyAsync(int questionId, string correctKey)
        {
            var q = await _questionRepository.GetByIdAsync(questionId);
            if (q == null) return;
            // Update the correct answer key for the question
            q.CorrectKey = correctKey;
            await _questionRepository.UpdateAsync(q);

            var allQuestionsInQuiz = await _questionRepository.GetByQuizTitleAsync(q.QuizTitle);
            decimal newQuizTotalScore = allQuestionsInQuiz.Sum(x => x.MaxScore);

            var quiz = await _questionRepository.GetQuizByTitleAsync(q.QuizTitle);
            if (quiz != null)
            {
                quiz.TotalScore = newQuizTotalScore; // Use your repository method to save the quiz update

                await _questionRepository.UpdateQuizAsync(quiz);
            }

            // 4. Re-grade all student submissions for this quiz
            var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(q.QuizTitle);
            foreach (var s in submissions)
            {
                var mcqAnswer = s.Answers.FirstOrDefault(a => a.QuestionId == questionId);
                if (mcqAnswer != null)
                {
                    // Re-check if the student's answer is correct now
                    mcqAnswer.IsCorrect = (mcqAnswer.StudentAnswer == correctKey);

                    // Assign score based on the CURRENT weight of the question
                    mcqAnswer.EarnedScore = (mcqAnswer.IsCorrect == true) ? q.MaxScore : 0.00m;

                    await _submissionRepository.SaveSubmissionAnswerAsync(mcqAnswer);
                }

                // 5. Re-calculate the Student's Final Score
                
                s.FinalScore = s.Answers.Sum(a => a.EarnedScore);
                await _submissionRepository.SaveSubmissionAsync(s);
            }
        }
    

        // Han - Implement RenameErrorTagAsync
        public async Task RenameErrorTagAsync(string oldTag, string newTag)
        {
            await _submissionRepository.RenameErrorTagAsync(oldTag, newTag);
        }
    }
}