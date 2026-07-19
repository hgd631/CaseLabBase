using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using CaseLabBase.BLL.DTOs;
using CaseLabBase.BLL.Services;

namespace CaseLabBase.Web.Controllers.Api
{
    [ApiController]
    [Route("api/[controller]")]
    public class ForumController : ControllerBase
    {
        private readonly ForumService _forumService;

        public ForumController(ForumService forumService)
        {
            _forumService = forumService;
        }

        [HttpGet("{topic}")]
        public async Task<IActionResult> GetForumComments(string topic)
        {
            if (string.IsNullOrWhiteSpace(topic)) return BadRequest("Topic is required.");
            var comments = await _forumService.GetForumTopicCommentsAsync(topic);
            return Ok(comments);
        }


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
