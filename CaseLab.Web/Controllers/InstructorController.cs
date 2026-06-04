using Microsoft.AspNetCore.Mvc;

namespace CaseLab.Web.Controllers
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
