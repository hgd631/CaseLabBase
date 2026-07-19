using System;
using System.IO;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using CaseLabBase.DAL;
using CaseLabBase.DAL.Repositories;
using CaseLabBase.BLL.Services;
using CaseLabBase.BLL.Observer;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Add DbContext
builder.Services.AddDbContext<CaseLabBaseDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register Repositories (DAL)
builder.Services.AddScoped<UserRepository>();
builder.Services.AddScoped<QuestionRepository>();
builder.Services.AddScoped<SubmissionRepository>();
builder.Services.AddScoped<ForumRepository>();
builder.Services.AddScoped<NotificationRepository>();

// Register Observers (BLL Observer Pattern)
builder.Services.AddScoped<ISubmissionObserver, TeacherNotificationObserver>();

// Register Services (BLL)
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<QuestionService>();
builder.Services.AddScoped<StudentService>();
builder.Services.AddScoped<InstructorService>();
builder.Services.AddScoped<ForumService>();

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

// Map API Controllers
app.MapControllers();

app.Run();