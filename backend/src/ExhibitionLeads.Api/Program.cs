using System.Text;
using ExhibitionLeads.Api.Controllers;
using ExhibitionLeads.Core.Entities;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Disable file watchers to prevent inotify limit crash on Render/Linux free tier
// (System.IO.IOException: configured user limit 128 on inotify instances reached)
foreach (var source in builder.Configuration.Sources.OfType<Microsoft.Extensions.Configuration.Json.JsonConfigurationSource>())
{
    source.ReloadOnChange = false;
}

// Add Controllers & Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS for Angular PWA & Hosted Clients
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularPwa", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure Port Binding for Cloud Hosting (Render / Fly.io / Azure)
var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");


// Configure Industrial Standard JWT Bearer Authentication
var jwtSecret = builder.Configuration["JwtSettings:Secret"] ?? "AriyAI_Super_Secret_JWT_Signing_Key_2026_Enterprise_Security!";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = true,
        ValidIssuer = "AriyAI.ExhibitionLeads",
        ValidateAudience = true,
        ValidAudience = "AriyAI.Client",
        ClockSkew = TimeSpan.Zero
    };
});

// Configure SQL Server / InMemory DbContext
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (!string.IsNullOrWhiteSpace(connectionString))
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(connectionString));
}
else
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseInMemoryDatabase("ExhibitionLeadsInMemoryDB"));
}

var app = builder.Build();

// Enable CORS immediately as the first middleware
app.UseCors("AllowAngularPwa");
app.UseStaticFiles();


// Ensure DB exists without deleting existing data
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.EnsureCreated();

    if (!dbContext.Users.Any())
    {
        var defaultPasswordHash = AuthController.HashPassword("Admin@123");
        
        var thalaimalaiUser = new User 
        { 
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"), 
            FullName = "Thalaimalai", 
            Username = "Thalaimalai", 
            Email = "thalaimalai@ariyai.com",
            UserGroup = "Naren-Marketing", 
            Role = "StallOwner", 
            Status = "Active", 
            PasswordHash = defaultPasswordHash 
        };

        var sanjayUser = new User 
        { 
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"), 
            FullName = "Sanjay", 
            Username = "sanjay", 
            Email = "sanjay@ariyai.com",
            UserGroup = "Naren Admin", 
            Role = "Admin", 
            Status = "Active", 
            PasswordHash = defaultPasswordHash 
        };

        dbContext.Users.AddRange(thalaimalaiUser, sanjayUser);

        if (!dbContext.Stalls.Any())
        {
            var defaultStall = new Stall
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                Name = "Stall 01 - Main Exhibition",
                Code = "STL-2026-001",
                EventName = "International Industrial TexFair 2026",
                Organizer = "SIMA Trade Association",
                DurationDays = 4,
                StartDate = DateTime.UtcNow.Date,
                EndDate = DateTime.UtcNow.Date.AddDays(4),
                Location = "Codissia Trade Fair Complex, Coimbatore",
                HallNumber = "Hall A",
                BoothNumber = "Booth 12",
                OwnerId = thalaimalaiUser.Id,
                OwnerName = thalaimalaiUser.FullName,
                Status = "Active"
            };
            dbContext.Stalls.Add(defaultStall);
            thalaimalaiUser.AssignedStallId = defaultStall.Id;
        }

        dbContext.SaveChanges();
    }
}

// Enable Swagger UI for easy testing across environments
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Exhibition Leads API v1");
    c.RoutePrefix = "swagger";
});


app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
