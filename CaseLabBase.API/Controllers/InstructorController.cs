using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.Linq;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.BLL.Services;
using CaseLabBase.DAL.Repositories;

namespace CaseLabBase.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // This controller handles instructor-related API endpoints.
    public class InstructorController : ControllerBase
    {
        
        private readonly InstructorService _instructorService;
        private readonly QuestionService _questionService;
        private readonly NotificationRepository _notifications;

        // Constructor to initialize the InstructorController with the required services and repositories.
        public InstructorController(InstructorService instructorService, QuestionService questionService, NotificationRepository notifications)
        {
            _instructorService = instructorService;
            _questionService = questionService;
            _notifications = notifications;
        }
        // Helper method to get the default quiz title if none is provided.
        private async Task<string?> GetDefaultQuizTitleAsync(string? quizTitle)
        {
            if (!string.IsNullOrEmpty(quizTitle)) return quizTitle;
            var quizzes = await _questionService.GetAllQuizzesAsync();
            return quizzes.FirstOrDefault()?.Title;
        }

        // GET: api/instructor/analytics
        // This endpoint retrieves analytics data for a specific quiz or the default quiz if none is specified.
        [HttpGet("analytics")]
        public async Task<IActionResult> GetAnalytics([FromQuery] string? quizTitle)
        {
            var title = await GetDefaultQuizTitleAsync(quizTitle);
            if (string.IsNullOrEmpty(title))
            {
                return NotFound("No quizzes are active to get analytics.");
            }

            var dto = await _instructorService.GetClassAnalyticsAsync(title);
            return Ok(dto);
        }

        [HttpGet("roster")]
        // This endpoint retrieves the roster of student submissions based on the specified sub-tab and quiz title.
        public async Task<IActionResult> GetRoster([FromQuery] string subTab, [FromQuery] string? quizTitle)
        {
            if (string.IsNullOrWhiteSpace(subTab)) subTab = "pending";

            var title = await GetDefaultQuizTitleAsync(quizTitle);
            if (string.IsNullOrEmpty(title))
            {
                return Ok(new System.Collections.Generic.List<SubmissionDTO>());
            }

            var roster = await _instructorService.GetRosterSubTabAsync(subTab, title);
            return Ok(roster);
        }

        [HttpPost("grade")]
        // This endpoint allows instructors to grade a student's submission and notify them of the results.
        public async Task<IActionResult> GradeSubmission([FromBody] GradeSubmissionRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.StudentId))
            {
                return BadRequest("Invalid grading request.");
            }

            try
            {
                var title = await GetDefaultQuizTitleAsync(request.QuizTitle);
                if (string.IsNullOrEmpty(title))
                {
                    return BadRequest("No active quiz title context.");
                }

                await _instructorService.GradeSubmissionAsync(request.StudentId, title, request.Grades);

                // Notify the specific student their results are ready
                await _notifications.NotifyUserAsync(
                    userId: request.StudentId,
                    title: "Your Results Are Ready",
                    message: $"Your submission for '{title}' has been graded. Check your Mistake Bank for feedback.",
                    linkUrl: "/Student/MistakeBank"
                );

                return Ok(new { Message = "Student submission graded and published." });
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new
                {
                    error = ex.Message,
                    stackTrace = ex.StackTrace,
                    innerException = ex.InnerException?.Message
                });
            }
        }

        
        [HttpGet("error-tags")]
        // This endpoint retrieves all error tags used in the system.
        public async Task<IActionResult> GetErrorTags()
        {
            var tags = await _instructorService.GetErrorTagsAsync();
            return Ok(tags);
        }

        [HttpPost("error-tags")]
        // This endpoint allows instructors to add a new error tag to the system.
        public async Task<IActionResult> AddErrorTag([FromBody] string tag)
        {
            if (string.IsNullOrWhiteSpace(tag)) return BadRequest("Tag content cannot be empty.");
            await _instructorService.AddErrorTagAsync(tag);
            return Ok(new { Message = "Grow card tag template added." });
        }

        [HttpPost("update-answer-key")]
        public async Task<IActionResult> UpdateAnswerKey([FromBody] UpdateAnswerKeyRequest request)
        {
            if (request == null) return BadRequest("Invalid request.");
            await _instructorService.UpdateAnswerKeyAsync(request.QuestionId, request.CorrectKey);
            return Ok(new { Message = "Answer key mutated and classroom re-graded." });
        }

        [HttpPost("rename-error-tag")]
        // This endpoint allows instructors to rename an existing error tag and merge it with another tag.
        public async Task<IActionResult> RenameErrorTag([FromBody] RenameErrorTagRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.OldTag) || string.IsNullOrWhiteSpace(request.NewTag))
            {
                return BadRequest("Invalid rename request.");
            }
            await _instructorService.RenameErrorTagAsync(request.OldTag, request.NewTag);
            return Ok(new { Message = "Error tag successfully renamed and merged " });
        }
    }
    // Request DTO for grading a student's submission.
    public class UpdateAnswerKeyRequest
    {
        public int QuestionId { get; set; }
        public string CorrectKey { get; set; } = null!;
    }
    // Request DTO for grading a student's submission.
    public class RenameErrorTagRequest
    {
        public string OldTag { get; set; } = null!;
        public string NewTag { get; set; } = null!;
    }
}
