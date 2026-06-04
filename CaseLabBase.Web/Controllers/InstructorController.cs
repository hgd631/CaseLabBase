using Microsoft.AspNetCore.Mvc;

namespace CaseLabBase.Web.Controllers
{
    public class InstructorController : Controller
    {
        public IActionResult Dashboard()
        {
            return View();
        }

        public IActionResult Grading()
        {
            return View();
        }
    }
}
