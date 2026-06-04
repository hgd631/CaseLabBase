using Microsoft.AspNetCore.Mvc;

namespace CaseLabBase.Web.Controllers
{
    public class ForumController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
