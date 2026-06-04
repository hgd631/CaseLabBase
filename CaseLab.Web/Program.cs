using System;
using System.IO;
using System.Linq;

#region Project Copy Automation
string baseDir = @"c:\Users\handa\OneDrive\Desktop\cs476";
try
{
    string sourceBase = "CaseLab";
    string targetBase = "CaseLabBase";
    string[] projectSuffixes = { "API", "BLL", "DAL", "Web" };
    
    // Force clean generation by deleting existing Base directories if they exist
    foreach (var suffix in projectSuffixes)
    {
        string destProj = Path.Combine(baseDir, $"{targetBase}.{suffix}");
        if (Directory.Exists(destProj))
        {
            try { Directory.Delete(destProj, true); } catch {}
        }
    }

    foreach (var suffix in projectSuffixes)
    {
        string srcProj = Path.Combine(baseDir, $"{sourceBase}.{suffix}");
        string destProj = Path.Combine(baseDir, $"{targetBase}.{suffix}");
        if (Directory.Exists(srcProj))
        {
            CopyDirectory(srcProj, destProj, sourceBase, targetBase);
        }
    }
    
    string srcSln = Path.Combine(baseDir, $"{sourceBase}.sln");
    string destSln = Path.Combine(baseDir, $"{targetBase}.sln");
    if (File.Exists(srcSln))
    {
        string slnContent = File.ReadAllText(srcSln).Replace(sourceBase, targetBase);
        File.WriteAllText(destSln, slnContent);
    }
}
catch (Exception ex)
{
    try { File.WriteAllText(Path.Combine(baseDir, "copy_error.txt"), ex.ToString()); } catch {}
}

static void CopyDirectory(string sourceDir, string targetDir, string sourceBase, string targetBase)
{
    Directory.CreateDirectory(targetDir);
    foreach (string file in Directory.GetFiles(sourceDir))
    {
        string fileName = Path.GetFileName(file);
        if (fileName.Contains(sourceBase))
        {
            fileName = fileName.Replace(sourceBase, targetBase);
        }
        string destFile = Path.Combine(targetDir, fileName);
        string ext = Path.GetExtension(file).ToLower();
        string[] textExtensions = { ".cs", ".csproj", ".cshtml", ".json", ".js", ".css", ".sql", ".txt", ".config" };
        if (textExtensions.Contains(ext))
        {
            string content = File.ReadAllText(file).Replace(sourceBase, targetBase);
            string normalizedDir = targetDir.Replace('/', '\\');
            if (normalizedDir.EndsWith(@"BLL\Services", StringComparison.OrdinalIgnoreCase))
            {
                content = StubOutBackendServices(fileName, content);
            }
            if (fileName == "app.js")
            {
                content = StubOutFrontendJS(content);
            }
            if (fileName == "Program.cs")
            {
                content = StripCopierScript(content);
            }
            File.WriteAllText(destFile, content);
        }
        else
        {
            File.Copy(file, destFile, true);
        }
    }
    foreach (string subDir in Directory.GetDirectories(sourceDir))
    {
        string dirName = Path.GetFileName(subDir);
        if (dirName == "bin" || dirName == "obj" || dirName == ".vs" || dirName == "node_modules") continue;
        CopyDirectory(subDir, Path.Combine(targetDir, dirName), sourceBase, targetBase);
    }
}


static string StubOutBackendServices(string fileName, string content)
{
    if (fileName == "AuthService.cs")
    {
        content = ReplaceFunctionBody(content, "public async Task<UserDTO?> GetUserByIdAsync(string id)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 1 - Implement GetUserByIdAsync in AuthService.cs\");");
    }
    else if (fileName == "QuestionService.cs")
    {
        content = ReplaceFunctionBody(content, "public async Task PublishNewTaskAsync(PublishTaskRequest request)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 1 - Implement PublishNewTaskAsync in QuestionService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task<List<QuizDTO>> GetAllQuizzesAsync()", 
            "throw new System.NotImplementedException(\"TODO: Team Member 1 - Implement GetAllQuizzesAsync in QuestionService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task<List<QuestionDTO>> GetActiveQuestionsAsync(string quizTitle)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 2 - Implement GetActiveQuestionsAsync in QuestionService.cs\");");
    }
    else if (fileName == "StudentService.cs")
    {
        content = ReplaceFunctionBody(content, "public async Task SubmitExamAsync(string studentId, string quizTitle, List<SubmitAnswerRequestItem> answers)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 2 - Implement SubmitExamAsync in StudentService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task<SubmissionDTO?> GetMistakeBankAsync(string studentId, string quizTitle)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 2 - Implement GetMistakeBankAsync in StudentService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task SubmitSurveyAsync(string studentId, string quizTitle, List<SubmitSurveyRequestItem> reflections)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 3 - Implement SubmitSurveyAsync in StudentService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task InitiateDisputeAsync(string studentId, int questionId, string reason)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 5 - Implement InitiateDisputeAsync in StudentService.cs\");");
    }
    else if (fileName == "InstructorService.cs")
    {
        content = ReplaceFunctionBody(content, "public async Task<ClassAnalyticsDTO> GetClassAnalyticsAsync(string quizTitle)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 3 - Implement GetClassAnalyticsAsync in InstructorService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task<List<SubmissionDTO>> GetRosterSubTabAsync(string subTab, string quizTitle)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 3 - Implement GetRosterSubTabAsync in InstructorService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task GradeSubmissionAsync(string studentId, string quizTitle, List<GradeQuestionItem> grades)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 4 - Implement GradeSubmissionAsync in InstructorService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task<List<string>> GetErrorTagsAsync()", 
            "throw new System.NotImplementedException(\"TODO: Team Member 4 - Implement GetErrorTagsAsync in InstructorService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task AddErrorTagAsync(string tag)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 4 - Implement AddErrorTagAsync in InstructorService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task UpdateAnswerKeyAsync(int questionId, string correctKey)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 4 - Implement UpdateAnswerKeyAsync in InstructorService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task ResolveDisputeAsync(string studentId, string quizTitle, int questionId, bool isApproved, decimal manualOverrideScore)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 5 - Implement ResolveDisputeAsync in InstructorService.cs\");");
    }
    else if (fileName == "ForumService.cs")
    {
        content = ReplaceFunctionBody(content, "public async Task<List<CommentDTO>> GetForumTopicCommentsAsync(string topic)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 5 - Implement GetForumTopicCommentsAsync in ForumService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task<List<CommentDTO>> GetDisputeCommentsAsync(string studentId, string topic)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 5 - Implement GetDisputeCommentsAsync in ForumService.cs\");");
        content = ReplaceFunctionBody(content, "public async Task AddCommentAsync(CommentDTO comment)", 
            "throw new System.NotImplementedException(\"TODO: Team Member 5 - Implement AddCommentAsync in ForumService.cs\");");
    }
    return content;
}

static string StubOutFrontendJS(string content)
{
    // ==========================================
    // MEMBER 1 - Authentication, Notifications & Sidebar navigation
    // ==========================================
    content = ReplaceFunctionBody(content, "async function loginAsRole(userId)",
        "// TODO: Team Member 1 - Post credentials to auth login API and route session user to their dashboard.\n    alert(\"TODO: Team Member 1 - Implement loginAsRole in app.js\");");
    content = ReplaceFunctionBody(content, "async function fetchNotifications()",
        "// TODO: Team Member 1 - Fetch unread notifications from /api/notifications and populate the dropdown badge.\n    alert(\"TODO: Team Member 1 - Implement fetchNotifications in app.js\");");
    content = ReplaceFunctionBody(content, "async function markAllNotifsRead()",
        "// TODO: Team Member 1 - Send POST request to notification mark-read endpoint and refresh current feed state.\n    alert(\"TODO: Team Member 1 - Implement markAllNotifsRead in app.js\");");
    content = ReplaceFunctionBody(content, "async function loadQuizzesSidebar()",
        "// TODO: Team Member 1 - Retrieve active quizzes list, handle sidebar navigation, and bind event selection triggers.\n    alert(\"TODO: Team Member 1 - Implement loadQuizzesSidebar in app.js\");");
    content = ReplaceFunctionBody(content, "async function instructorPublishTask()",
        "// TODO: Team Member 1 - Harvest form builder datasets, validate score weights, and publish the new quiz task to server.\n    alert(\"TODO: Team Member 1 - Implement instructorPublishTask in app.js\");");
    content = ReplaceFunctionBody(content, "async function renderInlineQuestionEditSection()",
        "// TODO: Team Member 1 - Load questions configuration list from API to expose inline answer mutation cards.\n    alert(\"TODO: Team Member 1 - Implement renderInlineQuestionEditSection in app.js\");");

    // ==========================================
    // MEMBER 2 - Student Examination & Auto-Grading Dashboard
    // ==========================================
    content = ReplaceFunctionBody(content, "async function loadQuestionsForExam()",
        "// TODO: Team Member 2 - Load active quiz configuration details and initialize questions list layout.\n    alert(\"TODO: Team Member 2 - Implement loadQuestionsForExam in app.js\");");
    content = ReplaceFunctionBody(content, "async function renderStudentDashboard()",
        "// TODO: Team Member 2 - Load student-assigned quizzes and mistake banks, rendering status buttons based on submission records.\n    alert(\"TODO: Team Member 2 - Implement renderStudentDashboard in app.js\");");
    content = ReplaceFunctionBody(content, "async function openStudentMistakeBankWithReload()",
        "// TODO: Team Member 2 - Query student evaluation logs for active mistake checks, compiling correct/incorrect answer states.\n    alert(\"TODO: Team Member 2 - Implement openStudentMistakeBankWithReload in app.js\");");

    // ==========================================
    // MEMBER 3 - Reflections, Roster & Analytics Metrics
    // ==========================================
    content = ReplaceFunctionBody(content, "async function completeSurveyPipeline()",
        "// TODO: Team Member 3 - Collect exam answer responses and reflections, submitting payloads to exam & survey endpoints.\n    alert(\"TODO: Team Member 3 - Implement completeSurveyPipeline in app.js\");");
    content = ReplaceFunctionBody(content, "async function loadQuestionDiagnostics()",
        "// TODO: Team Member 3 - Compile student feedback difficulty counts and flag potential anomaly rating discrepancies.\n    alert(\"TODO: Team Member 3 - Implement loadQuestionDiagnostics in app.js\");");
    content = ReplaceFunctionBody(content, "async function switchRosterSubTab(subTab)",
        "// TODO: Team Member 3 - Mutate active sub-tab view contexts and initiate roster table content refresh.\n    alert(\"TODO: Team Member 3 - Implement switchRosterSubTab in app.js\");");
    content = ReplaceFunctionBody(content, "async function renderMultiStudentRosterTable()",
        "// TODO: Team Member 3 - Retrieve student roster summaries filtered by tab parameters and render table rows.\n    alert(\"TODO: Team Member 3 - Implement renderMultiStudentRosterTable in app.js\");");

    // ==========================================
    // MEMBER 4 - Instructor Evaluation Desk & Grow Cards
    // ==========================================
    content = ReplaceFunctionBody(content, "async function routeTargetStudentToEvaluationDesk(studentId)",
        "// TODO: Team Member 4 - Load student submission and reflection logs, verifying automated crosscheck warnings.\n    alert(\"TODO: Team Member 4 - Implement routeTargetStudentToEvaluationDesk in app.js\");");
    content = ReplaceFunctionBody(content, "async function instructorSubmitEvaluation()",
        "// TODO: Team Member 4 - Compile allocated scores and feedback tags from grading panels, sending grades to commit endpoint.\n    alert(\"TODO: Team Member 4 - Implement instructorSubmitEvaluation in app.js\");");
    content = ReplaceFunctionBody(content, "async function loadInstructorGrowCards(answers = null)",
        "// TODO: Team Member 4 - Fetch templates configuration and build select feedback buttons for grading cards.\n    alert(\"TODO: Team Member 4 - Implement loadInstructorGrowCards in app.js\");");
    content = ReplaceFunctionBody(content, "async function generateGrowCardActionForQuestion(qId)",
        "// TODO: Team Member 4 - Post new custom feedback error tag template to database list and refresh banks.\n    alert(\"TODO: Team Member 4 - Implement generateGrowCardActionForQuestion in app.js\");");
    content = ReplaceFunctionBody(content, "async function inlineModifyAnswerKey(qId, val)",
        "// TODO: Team Member 4 - POST answer key mutation requests, triggering class-wide auto-regrading.\n    alert(\"TODO: Team Member 4 - Implement inlineModifyAnswerKey in app.js\");");

    // ==========================================
    // MEMBER 5 - Dispute override workflows & Forum boards
    // ==========================================
    content = ReplaceFunctionBody(content, "async function initiateStudentDisputeTicket(qId)",
        "// TODO: Team Member 5 - Prompt student reason statement, opens private dispute thread, and posts start comment.\n    alert(\"TODO: Team Member 5 - Implement initiateStudentDisputeTicket in app.js\");");
    content = ReplaceFunctionBody(content, "async function dispatchStudentEmbeddedChat(qId)",
        "// TODO: Team Member 5 - Send message from student inside embedded private chat channel.\n    alert(\"TODO: Team Member 5 - Implement dispatchStudentEmbeddedChat in app.js\");");
    content = ReplaceFunctionBody(content, "async function renderStudentEmbeddedPrivateChatArea(answers)",
        "// TODO: Team Member 5 - Load and render private dispute comments streams and audit buttons inside student logs.\n    alert(\"TODO: Team Member 5 - Implement renderStudentEmbeddedPrivateChatArea in app.js\");");
    content = ReplaceFunctionBody(content, "async function dispatchInstructorEmbeddedChat(studentId, qId)",
        "// TODO: Team Member 5 - Send message from teacher inside private dispute chat workspace.\n    alert(\"TODO: Team Member 5 - Implement dispatchInstructorEmbeddedChat in app.js\");");
    content = ReplaceFunctionBody(content, "async function executeInstructorManualScoreOverride(studentId, qId, isApproved)",
        "// TODO: Team Member 5 - Submit dispute audits and score override points registries.\n    alert(\"TODO: Team Member 5 - Implement executeInstructorManualScoreOverride in app.js\");");
    content = ReplaceFunctionBody(content, "async function initializeForumPage()",
        "// TODO: Team Member 5 - Load current forum active channels list and configure topic categories.\n    alert(\"TODO: Team Member 5 - Implement initializeForumPage in app.js\");");
    content = ReplaceFunctionBody(content, "async function teacherSubmitMaterial(panelId, topic)",
        "// TODO: Team Member 5 - Post study guide hyperlinks to specific topic forums.\n    alert(\"TODO: Team Member 5 - Implement teacherSubmitMaterial in app.js\");");
    content = ReplaceFunctionBody(content, "async function renderUnifiedForumComponent(targetContainerID, filterTopic)",
        "// TODO: Team Member 5 - Query forum comments for specific topics and render scroll streams.\n    alert(\"TODO: Team Member 5 - Implement renderUnifiedForumComponent in app.js\");");
    content = ReplaceFunctionBody(content, "async function dispatchLiveCommentSubmission(targetContainerID, filterTopic)",
        "// TODO: Team Member 5 - Post new comments to forum streams and update layouts.\n    alert(\"TODO: Team Member 5 - Implement dispatchLiveCommentSubmission in app.js\");");

    return content;
}

static string ReplaceFunctionBody(string content, string functionSignature, string stubBody)
{
    int idx = content.IndexOf(functionSignature);
    if (idx == -1)
    {
        string altSignature = functionSignature.Replace("async ", "");
        idx = content.IndexOf(altSignature);
        if (idx == -1) return content;
        functionSignature = altSignature;
    }
    int braceStart = content.IndexOf('{', idx + functionSignature.Length);
    if (braceStart == -1) return content;
    int braceCount = 1;
    int currentIdx = braceStart + 1;
    while (braceCount > 0 && currentIdx < content.Length)
    {
        if (content[currentIdx] == '{') braceCount++;
        else if (content[currentIdx] == '}') braceCount--;
        currentIdx++;
    }
    if (braceCount == 0)
    {
        string beforeBrace = content.Substring(0, braceStart + 1);
        string afterBrace = content.Substring(currentIdx - 1);
        return beforeBrace + "\n    " + stubBody + "\n" + afterBrace;
    }
    return content;
}

static string StripCopierScript(string content)
{
    int startIdx = content.IndexOf("#region" + " Project Copy Automation");
    int endIdx = content.IndexOf("#end" + "region");
    if (startIdx != -1 && endIdx != -1)
    {
        string before = content.Substring(0, startIdx);
        string after = content.Substring(endIdx + ("#end" + "region").Length);
        return before + after.TrimStart();
    }
    return content;
}
#endregion

var builder = WebApplication.CreateBuilder(args);

// Add services to the container (register MVC views & controllers)
builder.Services.AddControllersWithViews();

var app = builder.Build();

// Serve static assets from wwwroot folder (css/index.css, js/app.js)
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

// Setup standard MVC Routing
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
