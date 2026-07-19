using System;
using System.IO;
using System.Linq;
using CaseLabBase.API.Controllers;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers()
    .AddApplicationPart(typeof(CaseLabBase.API.Controllers.AuthController).Assembly);

// Add services to the container (register MVC views & controllers)
//builder.Services.AddControllers();
builder.Services.AddControllersWithViews();

var app = builder.Build();

// Serve static assets from wwwroot folder (css/index.css, js/app.js)
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();
app.MapControllers();
// Setup standard MVC Routing
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
