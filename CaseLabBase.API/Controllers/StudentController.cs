using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using System.Linq;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.BLL.Services;
using CaseLabBase.DAL.Repositories;

namespace CaseLabBase.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StudentController : ControllerBase
    {
        private readonly StudentService _studentService;
        private readonly QuestionService _questionService;

        public StudentController(StudentService studentService, QuestionService questionService)
        {
            _studentService = studentService;
            _questionService = questionService;
        }

        [HttpPost("submit-exam")]
        public async Task<IActionResult> SubmitExam([FromBody] SubmitExamRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.StudentId) || string.IsNullOrWhiteSpace(request.QuizTitle))
            {
                return BadRequest("Invalid exam submission data.");
            }

            try
            {
                await _studentService.SubmitExamAsync(request.StudentId, request.QuizTitle, request.Answers ?? new());

                return Ok(new { Message = "Exam submitted successfully." });
            }
            catch (Exception ex)
            {
                // Return full exception details so the client can display the real error
                var detail = ex.InnerException != null
                    ? $"{ex.Message} => {ex.InnerException.Message}"
                    : ex.Message;
                return StatusCode(500, new { Error = detail });
            }
        }

        [HttpPost("submit-survey")]
        public async Task<IActionResult> SubmitSurvey([FromBody] SubmitSurveyRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.StudentId) || string.IsNullOrWhiteSpace(request.QuizTitle))
            {
                return BadRequest("Invalid survey submission data.");
            }

            try
            {
                await _studentService.SubmitSurveyAsync(request.StudentId, request.QuizTitle, request.Reflections ?? new());
                return Ok(new { Message = "Survey reflections submitted successfully." });
            }
            catch (Exception ex)
            {
                var detail = ex.InnerException != null
                    ? $"{ex.Message} => {ex.InnerException.Message}"
                    : ex.Message;
                return StatusCode(500, new { Error = detail });
            }
        }

        [HttpGet("mistake-bank/{studentId}")]
        public async Task<IActionResult> GetMistakeBank(string studentId, [FromQuery] string? quizTitle)
        {
            if (string.IsNullOrEmpty(quizTitle))
            {
                var quizzes = await _questionService.GetAllQuizzesAsync();
                quizTitle = quizzes.FirstOrDefault()?.Title;
            }

            if (string.IsNullOrEmpty(quizTitle))
            {
                return NotFound("No active quizzes found.");
            }

            var dto = await _studentService.GetMistakeBankAsync(studentId, quizTitle);
            if (dto == null)
            {
                return NotFound($"Mistake bank for student {studentId} under quiz '{quizTitle}' not found.");
            }
            return Ok(dto);
        }

        [HttpPost("initiate-dispute")]
        public async Task<IActionResult> InitiateDispute([FromBody] InitiateDisputeRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.StudentId))
            {
                return BadRequest("Invalid dispute request data.");
            }

            await _studentService.InitiateDisputeAsync(request.StudentId, request.QuestionId, request.Message);
            return Ok(new { Message = "Dispute ticket opened and private chat initialized." });
        }
    }
}
