using System.Threading.Tasks;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.BLL.Observer
{


    // Subject interface for managing observers related to student exam submissions.
    public interface ISubmissionSubject
    {
        
        // Registers (subscribes) a new observer to listen for submission events.
        
        void RegisterObserver(ISubmissionObserver observer);

        
        // Unregisters (unsubscribes) an observer.
        
        void RemoveObserver(ISubmissionObserver observer);

        
        // Iterates through and notifies all registered observers.
        
        Task NotifyObserversAsync(Submission submission);
    }
}
