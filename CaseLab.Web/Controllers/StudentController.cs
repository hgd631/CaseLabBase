using Microsoft.AspNetCore.Mvc;

namespace CaseLab.Web.Controllers
{
    public class StudentController : Controller
    {
        public IActionResult Dashboard()
        {
            return View();
        }

        public IActionResult Exam()
        {
            return View();
        }

        public IActionResult Survey()
        {
            return View();
        }

        public IActionResult MistakeBank()
        {
            return View();
        }
    }
}
