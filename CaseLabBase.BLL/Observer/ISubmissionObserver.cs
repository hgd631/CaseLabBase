using System.Threading.Tasks;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.BLL.Observer
{

    //Observer interface for handling student exam submissions.
    // Implement this interface to receive notifications when a student submits an exam.
   

    public interface ISubmissionObserver
    {
       
        // Triggered automatically when the Subject (StudentService) processes an exam submission.
        
        // <param name="submission">The newly created student exam submission entity.</param>
        Task OnSubmittedAsync(Submission submission);
    }
}
