using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.BLL.Services;

namespace CaseLabBase.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // This controller handles forum-related API endpoints.
    public class ForumController : ControllerBase
    {
        // Dependency injection of the ForumService to handle forum operations.
        private readonly ForumService _forumService;

        // Constructor to initialize the ForumController with the ForumService.
        public ForumController(ForumService forumService)
        {
            _forumService = forumService;
        }

        // GET: api/forum/{topic}
        // This endpoint retrieves comments for a specific forum topic.
        [HttpGet("{topic}")]
        public async Task<IActionResult> GetForumComments(string topic)
        {
            if (string.IsNullOrWhiteSpace(topic)) return BadRequest("Topic is required.");
            var comments = await _forumService.GetForumTopicCommentsAsync(topic);
            return Ok(comments);
        }

        // POST: api/forum/comment
        // This endpoint allows users to post a new comment to the forum.
        [HttpPost("comment")]
        public async Task<IActionResult> PostComment([FromBody] CommentDTO commentDto)
        {
            if (commentDto == null || string.IsNullOrWhiteSpace(commentDto.Topic) || string.IsNullOrWhiteSpace(commentDto.Message))
            {
                return BadRequest("Invalid comment data.");
            }

            commentDto.Timestamp = DateTime.SpecifyKind(DateTime.Now, DateTimeKind.Utc);

            await _forumService.AddCommentAsync(commentDto);
            return Ok(new { Message = "Comment added successfully." });
        }
    }
}
