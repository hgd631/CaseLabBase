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
    public class QuestionsController : ControllerBase
    {
        private readonly QuestionService _questionService;
        private readonly NotificationRepository _notifications;

        public QuestionsController(QuestionService questionService, NotificationRepository notifications)
        {
            _questionService = questionService;
            _notifications = notifications;
        }

        [HttpGet]
        public async Task<IActionResult> GetActiveQuestions([FromQuery] string? quizTitle)
        {
            if (string.IsNullOrEmpty(quizTitle))
            {
                var quizzes = await _questionService.GetAllQuizzesAsync();
                if (quizzes.Count > 0)
                {
                    quizTitle = quizzes[0].Title;
                }
                else
                {
                    return NotFound("No quizzes are active.");
                }
            }

            var quiz = (await _questionService.GetAllQuizzesAsync()).FirstOrDefault(q => q.Title == quizTitle);
            if (quiz == null)
            {
                return NotFound($"Quiz '{quizTitle}' not found.");
            }

            var list = await _questionService.GetActiveQuestionsAsync(quizTitle);
            return Ok(new
            {
                Title = quiz.Title,
                Questions = list,
                TimeLimitMinutes = quiz.TimeLimitMinutes,
                IsQuizOpen = quiz.IsQuizOpen,
                IsForumOpen = quiz.IsForumOpen,
                DeadlineString = quiz.DeadlineString,
                PdfBase64 = quiz.PdfBase64,
                QuizMode = quiz.QuizMode,
                TotalScore = quiz.TotalScore
            });
        }

        [HttpGet("quizzes")]
        public async Task<IActionResult> GetAllQuizzes()
        {
            var list = await _questionService.GetAllQuizzesAsync();
            return Ok(list);
        }

        [HttpPost("publish")]
        public async Task<IActionResult> PublishNewTask([FromBody] PublishTaskRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Title) || request.Questions == null || request.Questions.Count == 0)
            {
                return BadRequest("Invalid publication request payload.");
            }

            try
            {
                await _questionService.PublishNewTaskAsync(request);

                // Notify all students a new quiz is available
                await _notifications.NotifyAllStudentsAsync(
                    title: $"New Quiz Published: {request.Title}",
                    message: $"A new assignment '{request.Title}' has been published. Check your dashboard to start.",
                    linkUrl: "/Student/Dashboard"
                );

                return Ok(new { Message = "New task published successfully." });
            }
            catch (System.ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
