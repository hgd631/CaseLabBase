using CaseLabBase.DAL.Entities;

namespace CaseLabBase.BLL.Factory
{
    
    // GoF Design Pattern: Simple Factory / Factory Method
    // Purpose: Decouples the client (QuestionService) from concrete question creation logic.
    // This abstract class defines the Creator interface for producing Question products.
    
    public abstract class QuestionCreator
    {
        
        // Factory Method to be overridden by concrete question creators.
        
        public abstract Question Create(string quizTitle, string prompt, string? topic, string? optionsJson, string correctKey, decimal maxScore);
    }

    
    // Concrete Creator for Multiple Choice Questions (MCQ).
    
    public class McqQuestionCreator : QuestionCreator
    {
        
        // Instantiates and configures a Question entity specifically formatted for MCQs.
        
        public override Question Create(string quizTitle, string prompt, string? topic, string? optionsJson, string correctKey, decimal maxScore)
        {
            return new Question
            {
                Type = "MCQ",
                QuizTitle = quizTitle,
                Prompt = prompt,
                Topic = string.IsNullOrWhiteSpace(topic) ? "General" : topic,
                Options = optionsJson,
                CorrectKey = correctKey,
                MaxScore = maxScore
            };
        }
    }

    
    // Concrete Creator for Essay Questions.
    
    public class EssayQuestionCreator : QuestionCreator
    {
        
        // Instantiates and configures a Question entity specifically formatted for Essay/Self-written answers.
        // Essays do not have pre-defined correct options or auto-grading keys.
        
        public override Question Create(string quizTitle, string prompt, string? topic, string? optionsJson, string correctKey, decimal maxScore)
        {
            return new Question
            {
                Type = "Essay",
                QuizTitle = quizTitle,
                Prompt = prompt,
                Topic = string.IsNullOrWhiteSpace(topic) ? "General" : topic,
                Options = null,
                CorrectKey = "",
                MaxScore = maxScore
            };
        }
    }

    
    // Simple Factory Client Interface.
    // Selects the appropriate concrete creator at runtime based on the type of question requested.
    
    public static class QuestionFactory
    {
        
        // Entry point for creating questions dynamically.
        
        // <param name="type">Type of question: "MCQ" or "Essay"</param>
        public static Question Create(string type, string quizTitle, string prompt, string? topic, string? optionsJson, string correctKey, decimal maxScore)
        {
            // Decides which concrete subclass to instantiate based on runtime parameters
            QuestionCreator creator = type.ToUpper() switch
            {
                "MCQ" => new McqQuestionCreator(),
                "ESSAY" => new EssayQuestionCreator(),
                _ => throw new System.ArgumentException($"Unsupported question type: {type}")
            };
            return creator.Create(quizTitle, prompt, topic, optionsJson, correctKey, maxScore);
        }
    }
}
