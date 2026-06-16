using Microsoft.EntityFrameworkCore;
using CaseLabBase.DAL;
using CaseLabBase.DAL.Repositories;
using CaseLabBase.BLL.Services;
using CaseLabBase.BLL.Observer;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddDbContext<CaseLabBaseDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

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

builder.Services.AddControllers();

// Configure CORS to allow static frontend files (e.g. index.html) to call API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

app.UseCors("AllowAll");

app.UseAuthorization();

app.MapControllers();

app.Run();
