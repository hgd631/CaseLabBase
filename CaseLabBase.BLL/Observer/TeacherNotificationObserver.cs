using System.Threading.Tasks;
using CaseLabBase.DAL.Entities;
using CaseLabBase.DAL.Repositories;

namespace CaseLabBase.BLL.Observer
{

    //Observer implementation that handles notifications for teachers when a student submits an exam.
    public class TeacherNotificationObserver : ISubmissionObserver
    {
        private readonly NotificationRepository _notificationRepository;

       
        // Constructor receives the NotificationRepository dependency via Dependency Injection.
        
        public TeacherNotificationObserver(NotificationRepository notificationRepository)
        {
            _notificationRepository = notificationRepository;
        }

        
        // Implementation of the Observer contract. Called automatically by the Subject.
        
        public async Task OnSubmittedAsync(Submission submission)
        {
            // Decoupled notification call, writes a notification entry to DB
            await _notificationRepository.NotifyAllTeachersAsync(
                title: "New Submission Received",
                message: $"A student (ID: {submission.StudentId}) submitted '{submission.QuizTitle}'. Ready for grading.",
                linkUrl: $"/Instructor/Dashboard?quizTitle={System.Uri.EscapeDataString(submission.QuizTitle)}"
            );
        }
    }
}
