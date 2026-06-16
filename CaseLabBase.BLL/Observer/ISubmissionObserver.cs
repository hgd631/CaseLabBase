using System.Threading.Tasks;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.BLL.Observer
{
   
    // GoF Design Pattern: Observer
    // Purpose: Defines a standard interface for objects that should be notified
    // of changes or actions occurring on a Subject.
    // This acts as the "Observer" contract in the Gang of Four design.
    
    public interface ISubmissionObserver
    {
       
        // Triggered automatically when the Subject (StudentService) processes an exam submission.
        
        // <param name="submission">The newly created student exam submission entity.</param>
        Task OnSubmittedAsync(Submission submission);
    }
}
