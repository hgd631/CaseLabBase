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
            //Fetch Submissions: Retrieve all student submissions along with their nested answers for this specific quiz
            var submissions = await _submissionRepository.GetSubmissionsByQuizWithAnswersAsync(quizTitle);
            int total = submissions.Count;
            int graded = submissions.Count(s => s.Status == "Graded"); // Filter to count only fully evaluated papers

            // Fetch Quiz Metadata: Get the quiz structure to check the maximum achievable score (defaults to 10.00 if null)
            var quiz = await _questionRepository.GetQuizByTitleAsync(quizTitle);
            decimal totalScore = quiz?.TotalScore ?? 10.00m;

            //  Defect/Failure Rate Calculation: Find the percentage of graded submissions that scored below an 80% threshold
            decimal defectRate = 0;
            if (graded > 0)
            {
                // Count how many students scored lower than 80% of the total available points
                int failed = submissions.Count(s => s.Status == "Graded" && s.FinalScore < 0.80m * totalScore);
                defectRate = ((decimal)failed / graded) * 100;
            }

            // Class Average Calculation: Compute the arithmetic mean of all final scores across the dataset
            decimal avg = 0;
            if (submissions.Count > 0)
            {
                avg = submissions.Average(s => s.FinalScore);
            }

            // Data Transfer Object (DTO) Return: Package up the computed analytics metrics to ship cleanly to the frontend
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
            throw new System.NotImplementedException("TODO: Team Member 3 - Implement GetRosterSubTabAsync in InstructorService.cs");
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
                    answer.TeacherFeedback = gradeItem.TeacherFeedback;

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


        //Team Member 5 - Ethan - Implement of instructor dispute resolution and manual score override processing
        public async Task ResolveDisputeAsync(string studentId, string quizTitle, int questionId, bool isApproved, decimal manualOverrideScore)
        {
            // FIXED: Fully qualified with 'System.' to avoid namespace errors if 'using System;' is missing
            // Validate the required dispute information.
            if (string.IsNullOrWhiteSpace(studentId))
            {
                throw new System.ArgumentException("Student ID is required.", nameof(studentId));
            }

            if (string.IsNullOrWhiteSpace(quizTitle))
            {
                throw new System.ArgumentException("Quiz title is required.", nameof(quizTitle));
            }

            if (questionId <= 0)
            {
                throw new System.ArgumentException(
                    "A valid question ID is required.",
                    nameof(questionId)
                );
            }

            if (manualOverrideScore < 0)
            {
                throw new System.ArgumentException(
                    "The manual override score cannot be negative.",
                    nameof(manualOverrideScore)
                );
            }

            // Retrieve the student's submission and its associated answers.
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);

            // FIXED: Fetch the corresponding dispute ticket from database to update its status
            var ticket = await _forumRepository.GetTicketAsync(studentId, questionId);

            if (submission == null || ticket == null)
            {
                // FIXED: Using return instead of throwing raw exception to match standard CaseLab controller fallback
                return;
            }

            // Locate the answer associated with the disputed question.
            var disputedAnswer = submission.Answers.FirstOrDefault(answer => answer.QuestionId == questionId);

            if (disputedAnswer == null)
            {
                throw new System.InvalidOperationException(
                    $"Question '{questionId}' was not found in the student's submission."
                );
            }

            if (isApproved)
            {
                // Apply the score selected by the instructor.
                disputedAnswer.EarnedScore = manualOverrideScore;

                // FIXED: Update answer correctness and tag based on the 80% maximum score threshold
                if (manualOverrideScore >= 0.80m * disputedAnswer.Question.MaxScore)
                {
                    disputedAnswer.IsCorrect = true;
                    disputedAnswer.TeacherTag = "Passed Framework Checklist via Manual Override Revision";
                }
                else
                {
                    disputedAnswer.TeacherTag = $"Partial Credit Granted: Adjusted to {manualOverrideScore} pts";
                }

                await _submissionRepository.SaveSubmissionAnswerAsync(disputedAnswer);

                // Recalculate the overall submission score after the override.
                submission.FinalScore = submission.Answers.Sum(answer => answer.EarnedScore);

                // FIXED: Set DisputeStatus to "Resolved_Accepted" (instead of "Approved") to match UI filters & database constraints
                submission.DisputeStatus = "Resolved_Accepted";
                ticket.Status = "Accepted";

                // FIXED: Log system comment in the private dispute chat thread
                var comment = new Comment
                {
                    IsPrivate = true,
                    StudentId = studentId,
                    Topic = "Dispute Q" + questionId,
                    Sender = "Dr. Ali Bayeh (Instructor)",
                    Message = $"🟢 [Dispute Resolved]: Evaluation audited manually. Variable point score overridden at: {manualOverrideScore} / {disputedAnswer.Question.MaxScore} pts.",
                    Timestamp = System.DateTime.Now
                };
                await _forumRepository.AddCommentAsync(comment);
            }
            else
            {
                // FIXED: Set DisputeStatus to "Resolved_Rejected" (instead of "Rejected") to match UI filters
                submission.DisputeStatus = "Resolved_Rejected";
                ticket.Status = "Rejected";

                // FIXED: Log system comment in the private dispute chat thread for rejection
                var comment = new Comment
                {
                    IsPrivate = true,
                    StudentId = studentId,
                    Topic = "Dispute Q" + questionId,
                    Sender = "Dr. Ali Bayeh (Instructor)",
                    Message = "❌ [Dispute Concluding]: Initial evaluation parameters sustained.",
                    Timestamp = System.DateTime.Now
                };
                await _forumRepository.AddCommentAsync(comment);
            }

            await _submissionRepository.SaveSubmissionAsync(submission);

            // FIXED: Save the resolved ticket state back to database (otherwise it will remain 'Pending' on UI dashboard)
            await _forumRepository.SaveTicketAsync(ticket);
        }


        // Han - Implement ResolveSubmissionDisputeAsync
        public async Task ResolveSubmissionDisputeAsync(string studentId, string quizTitle, bool isApproved)
        {
            var submission = await _submissionRepository.GetByStudentIdAndQuizWithAnswersAsync(studentId, quizTitle);
            if (submission == null) return;

            submission.DisputeStatus = isApproved ? "Resolved_Accepted" : "Resolved_Rejected";
            await _submissionRepository.SaveSubmissionAsync(submission);

            // Close any pending tickets for this student under this quiz (if any)
            var tickets = await _forumRepository.GetAllTicketsAsync();
            var submissionQuestions = submission.Answers.Select(a => a.QuestionId).ToList();
            var activeTickets = tickets.Where(t => t.StudentId == studentId && submissionQuestions.Contains(t.QuestionId) && t.Status == "Pending").ToList();
            foreach (var ticket in activeTickets)
            {
                ticket.Status = isApproved ? "Accepted" : "Rejected";
                await _forumRepository.SaveTicketAsync(ticket);
            }

            // Log private thread resolution comment
            var comment = new Comment
            {
                IsPrivate = true,
                StudentId = studentId,
                Topic = "Dispute " + studentId + " - " + quizTitle,
                Sender = "Dr. Ali Bayeh (Instructor)",
                Message = $"🟢 [Submission Dispute Resolved]: Audit finalized. Status marked as {(isApproved ? "Approved (Accepted)" : "Closed (Rejected)")}. Final submission score stands at {submission.FinalScore} pts.",
                Timestamp = DateTime.Now
            };
            await _forumRepository.AddCommentAsync(comment);
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

        public async Task RenameErrorTagAsync(string oldTag, string newTag)
        {
            await _submissionRepository.RenameErrorTagAsync(oldTag, newTag);
        }

    }
}
