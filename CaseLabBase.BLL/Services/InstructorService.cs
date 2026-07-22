using CaseLabBase.BLL.DTOs;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;
using System;
using System.Collections.Generic;
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
        // Updated by Han using manual loops
        public async Task<ClassAnalyticsDTO> GetClassAnalyticsAsync(string quizTitle)
        {
            var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(quizTitle);

            int total = 0;
            int graded = 0;
            int failed = 0;
            decimal totalFinalScoreSum = 0;

            var quiz = await _questionRepository.GetQuizByTitleAsync(quizTitle);
            decimal totalScoreLimit = quiz?.TotalScore ?? 10.00m;

            foreach (var s in submissions)
            {
                total++;
                if (s.Status == "Graded")
                {
                    graded++;
                    totalFinalScoreSum += s.FinalScore;
                    if (s.FinalScore < 0.80m * totalScoreLimit)
                    {
                        failed++;
                    }
                }
            }

            decimal defectRate = 0;
            if (graded > 0) defectRate = ((decimal)failed / graded) * 100;

            decimal avg = 0;
            if (total > 0) avg = totalFinalScoreSum / total;

            return new ClassAnalyticsDTO
            {
                ActiveTaskTitle = quizTitle,
                TotalSubmissionsCount = total,
                GradedCount = graded,
                FailureRatePercentage = Math.Round(defectRate, 1),
                ClassAverageScore = Math.Round(avg, 1)
            };
        }

        // Hitesh - Implement GetRosterSubTabAsync 
        // Updated by Han to support manual reflection analysis
        public async Task<List<SubmissionDTO>> GetRosterSubTabAsync(string subTab, string quizTitle)
        {
            var allSubmissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(quizTitle);
            var resultList = new List<SubmissionDTO>();

            var quiz = await _questionRepository.GetQuizByTitleAsync(quizTitle);
            decimal totalScoreLimit = quiz?.TotalScore ?? 10.00m;

            foreach (var s in allSubmissions)
            {
                
                bool include = false;
                if (subTab == "all") include = true;
                else if (subTab == "pending" && s.Status == "Pending") include = true;
                else if (subTab == "graded" && s.Status == "Graded") include = true;

                if (include)
                {
                    var dto = new SubmissionDTO
                    {
                        StudentId = s.StudentId,
                        StudentName = s.Student.Name,
                        Status = s.Status,
                        FinalScore = s.FinalScore,
                        SurveyDifficulty = s.SurveyDifficulty,
                        SurveyPainPoint = s.SurveyPainPoint,
                        IsFlagged = (s.SurveyDifficulty == "Hard" && s.FinalScore >= 0.80m * totalScoreLimit),
                        Answers = new List<SubmissionAnswerDTO>()
                    };

                    foreach (var a in s.Answers)
                    {
                        dto.Answers.Add(new SubmissionAnswerDTO
                        {
                            QuestionId = a.QuestionId,
                            QuestionPrompt = a.Question.Prompt,
                            QuestionTopic = a.Question.Topic,
                            QuestionType = a.Question.Type,
                            StudentAnswer = a.StudentAnswer,
                            IsCorrect = a.IsCorrect,
                            TeacherTag = a.TeacherTag,
                            EarnedScore = a.EarnedScore,
                            TeacherFeedback = a.TeacherFeedback
                        });
                    }
                    resultList.Add(dto);
                }
            }
            return resultList;
        }

        // Soni - Implement GradeSubmissionAsync
        // Fixed by Han: Cap score at MaxScore to prevent 11/10
        public async Task GradeSubmissionAsync(string studentId, string quizTitle, List<GradeQuestionItem> grades)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null) throw new ArgumentException("Not found.");

            submission.Status = "Graded";

            foreach (var answer in submission.Answers)
            {
                foreach (var gradeItem in grades)
                {
                    if (gradeItem.QuestionId == answer.QuestionId)
                    {
                        decimal finalPoints = gradeItem.EarnedScore;

                        // Cap at MaxScore
                        if (finalPoints > answer.Question.MaxScore)
                        {
                            finalPoints = answer.Question.MaxScore;
                        }

                        answer.EarnedScore = finalPoints;
                        answer.TeacherFeedback = gradeItem.TeacherFeedback;

                        if (answer.Question.Type == "Essay")
                        {
                            answer.TeacherTag = !string.IsNullOrEmpty(gradeItem.ChosenTag) ? gradeItem.ChosenTag : "Graded";
                            answer.IsCorrect = (answer.EarnedScore == answer.Question.MaxScore);
                        }
                        await _submissionRepository.SaveSubmissionAnswerAsync(answer);
                    }
                }
            }

            // Manual Sum Calculation
            decimal newFinalScore = 0;
            foreach (var a in submission.Answers)
            {
                newFinalScore += a.EarnedScore;
            }

            submission.FinalScore = newFinalScore;
            await _submissionRepository.SaveSubmissionAsync(submission);
        }

        // Soni - Implement UpdateAnswerKeyAsync
        // Fixed by Han: Recalculate everything with manual loops
        public async Task UpdateAnswerKeyAsync(int questionId, string correctKey)
        {
            var q = await _questionRepository.GetByIdAsync(questionId);
            if (q == null) return;

            q.CorrectKey = correctKey;
            await _questionRepository.UpdateAsync(q);

            // Manual sum for Quiz Total Score
            var allQuestions = await _questionRepository.GetByQuizTitleAsync(q.QuizTitle);
            decimal quizTotal = 0;
            foreach (var item in allQuestions)
            {
                quizTotal += item.MaxScore;
            }

            var quiz = await _questionRepository.GetQuizByTitleAsync(q.QuizTitle);
            if (quiz != null)
            {
                quiz.TotalScore = quizTotal;
                await _questionRepository.UpdateQuizAsync(quiz);
            }

            // Manual re-grading logic
            var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(q.QuizTitle);
            foreach (var s in submissions)
            {
                decimal studentNewScore = 0;
                foreach (var ans in s.Answers)
                {
                    if (ans.QuestionId == questionId)
                    {
                        ans.IsCorrect = (ans.StudentAnswer == correctKey);
                        ans.EarnedScore = (ans.IsCorrect == true) ? q.MaxScore : 0.00m;
                        await _submissionRepository.SaveSubmissionAnswerAsync(ans);
                    }
                    studentNewScore += ans.EarnedScore;
                }
                s.FinalScore = studentNewScore;
                await _submissionRepository.SaveSubmissionAsync(s);
            }
        }

        public async Task<List<string>> GetErrorTagsAsync()
        {
            var list = await _submissionRepository.GetErrorTagsAsync();
            var tags = new List<string>();
            foreach (var t in list) { tags.Add(t.Tag); }
            return tags;
        }

        public async Task AddErrorTagAsync(string tag)
        {
            await _submissionRepository.AddErrorTagAsync(new ErrorTag { Tag = tag });
        }

        public async Task RenameErrorTagAsync(string oldTag, string newTag)
        {
            await _submissionRepository.RenameErrorTagAsync(oldTag, newTag);
        }
    }
}