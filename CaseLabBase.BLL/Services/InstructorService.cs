using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;

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

        // Han  - Implement GetClassAnalyticsAsync in InstructorService.cs
        public async Task<ClassAnalyticsDTO> GetClassAnalyticsAsync(string quizTitle)
        {
            // 1. Fetch Submissions: Retrieve all student submissions along with their nested answers for this specific quiz
            var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(quizTitle);
            int total = submissions.Count;
            int graded = submissions.Count(s => s.Status == "Graded"); // Filter to count only fully evaluated papers

            // 2. Fetch Quiz Metadata: Get the quiz structure to check the maximum achievable score (defaults to 10.00 if null)
            var quiz = await _questionRepository.GetQuizByTitleAsync(quizTitle);
            decimal totalScore = quiz?.TotalScore ?? 10.00m;

            // 3. Defect/Failure Rate Calculation: Find the percentage of graded submissions that scored below an 80% threshold
            decimal defectRate = 0;
            if (graded > 0)
            {
                // Count how many students scored lower than 80% of the total available points
                int failed = submissions.Count(s => s.Status == "Graded" && s.FinalScore < 0.80m * totalScore);
                defectRate = ((decimal)failed / graded) * 100;
            }

            // 4. Class Average Calculation: Compute the arithmetic mean of all final scores across the dataset
            decimal avg = 0;
            if (submissions.Count > 0)
            {
                avg = submissions.Average(s => s.FinalScore);
            }

            // 5. Data Transfer Object (DTO) Return: Package up the computed analytics metrics to ship cleanly to the frontend
            return new ClassAnalyticsDTO
            {
                ActiveTaskTitle = quizTitle,
                TotalSubmissionsCount = total,
                GradedCount = graded,
                FailureRatePercentage = Math.Round(defectRate, 1), // Round to 1 decimal place for UI presentation
                ClassAverageScore = Math.Round(avg, 1)
            };
        }



public async Task<List<SubmissionDTO>> GetRosterSubTabAsync(string subTab, string quizTitle)
{
    // 1. Fetch all submissions for this quiz, with Student and Answers/Question already loaded
    var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(quizTitle);

    // 2. Filter by the requested sub-tab
    IEnumerable<Submission> filtered = subTab switch
    {
        "pending" => submissions.Where(s => s.Status != "Graded"),
        "graded" => submissions.Where(s => s.Status == "Graded"),
        "dispute" => submissions.Where(s => s.DisputeStatus != "None"),
        "all" => submissions,
        _ => submissions.Where(s => s.Status != "Graded") // default to pending if an unknown subTab is passed
    };

    // Member 3- Hitesh : Map each Submission entity into a SubmissionDTO for the frontend
    return filtered.Select(s => new SubmissionDTO
    {
        StudentId = s.StudentId,
        StudentName = s.Student.Name,
        Status = s.Status,
        FinalScore = s.FinalScore,
        SurveyPainPoint = s.SurveyPainPoint,
        DisputeStatus = s.DisputeStatus,
        Answers = s.Answers.Select(a => new SubmissionAnswerDTO
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
    }).ToList();
}
        public async Task GradeSubmissionAsync(string studentId, string quizTitle, List<GradeQuestionItem> grades)
        {
            throw new System.NotImplementedException("TODO: Team Member 4 - Implement GradeSubmissionAsync in InstructorService.cs");
        }

        public async Task ResolveDisputeAsync(string studentId, string quizTitle, int questionId, bool isApproved, decimal manualOverrideScore)
        {
            throw new System.NotImplementedException("TODO: Team Member 5 - Implement ResolveDisputeAsync in InstructorService.cs");
        }

        // Han  - Implement GetErrorTagsAsync in InstructorService
        public async Task<List<string>> GetErrorTagsAsync()
        {
            var list = await _submissionRepository.GetErrorTagsAsync();
            return list.Select(t => t.Tag).ToList();
        }

        // Han  - Implement AddErrorTagAsync in InstructorService
        public async Task AddErrorTagAsync(string tag)
        {
            await _submissionRepository.AddErrorTagAsync(new ErrorTag { Tag = tag });
        }



        // Member Han  - Implement UpdateAnswerKeyAsync in InstructorService
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
