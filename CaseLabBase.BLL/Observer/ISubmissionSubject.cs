using System.Threading.Tasks;
using CaseLabBase.DAL.Entities;

namespace CaseLabBase.BLL.Observer
{
    
    // GoF Design Pattern: Observer (Subject)
    //  Defines interface for registering, removing, and notifying observers.
    // This acts as the "Subject" contract in the Gang of Four design.
  
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
