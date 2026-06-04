using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.Linq;
using CaseLab.BLL.DTOs;
using CaseLab.BLL.Services;
using CaseLab.DAL.Repositories;

namespace CaseLab.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InstructorController : ControllerBase
    {
        private readonly InstructorService _instructorService;
        private readonly QuestionService _questionService;
        private readonly NotificationRepository _notifications;

        public InstructorController(InstructorService instructorService, QuestionService questionService, NotificationRepository notifications)
        {
            _instructorService = instructorService;
            _questionService = questionService;
            _notifications = notifications;
        }

        private async Task<string?> GetDefaultQuizTitleAsync(string? quizTitle)
        {
            if (!string.IsNullOrEmpty(quizTitle)) return quizTitle;
            var quizzes = await _questionService.GetAllQuizzesAsync();
            return quizzes.FirstOrDefault()?.Title;
        }

        [HttpGet("analytics")]
        public async Task<IActionResult> GetAnalytics([FromQuery] string? quizTitle)
        {
            var title = await GetDefaultQuizTitleAsync(quizTitle);
            if (string.IsNullOrEmpty(title))
            {
                return NotFound("No quizzes are active to retrieve analytics.");
            }

            var dto = await _instructorService.GetClassAnalyticsAsync(title);
            return Ok(dto);
        }

        [HttpGet("roster")]
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
        public async Task<IActionResult> GradeSubmission([FromBody] GradeSubmissionRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.StudentId))
            {
                return BadRequest("Invalid grading request.");
            }

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

        [HttpPost("resolve-dispute")]
        public async Task<IActionResult> ResolveDispute([FromBody] ResolveDisputeRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.StudentId))
            {
                return BadRequest("Invalid dispute resolution request.");
            }

            var title = await GetDefaultQuizTitleAsync(request.QuizTitle);
            if (string.IsNullOrEmpty(title))
            {
                return BadRequest("No active quiz title context.");
            }

            await _instructorService.ResolveDisputeAsync(request.StudentId, title, request.QuestionId, request.IsApproved, request.ManualOverrideScore);
            return Ok(new { Message = "Dispute resolved and status updated." });
        }

        [HttpGet("error-tags")]
        public async Task<IActionResult> GetErrorTags()
        {
            var tags = await _instructorService.GetErrorTagsAsync();
            return Ok(tags);
        }

        [HttpPost("error-tags")]
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
    }

    public class UpdateAnswerKeyRequest
    {
        public int QuestionId { get; set; }
        public string CorrectKey { get; set; } = null!;
    }
}
