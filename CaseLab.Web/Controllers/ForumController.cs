using Microsoft.AspNetCore.Mvc;

namespace CaseLab.Web.Controllers
{
    public class ForumController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
