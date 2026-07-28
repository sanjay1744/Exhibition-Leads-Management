using System.Text;
using ExhibitionLeads.Api.Controllers;
using ExhibitionLeads.Core.Entities;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add Controllers & Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS for Angular PWA
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularPwa", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://localhost:4201")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

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

// Configure InMemory / PostgreSQL DbContext
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (!string.IsNullOrEmpty(connectionString))
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(connectionString));
}
else
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseInMemoryDatabase("ExhibitionLeadsInMemoryDB"));
}

var app = builder.Build();

// Ensure InMemory / Dev DB created & Seed Users from Screenshot
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.EnsureCreated();

    if (!dbContext.Users.Any())
    {
        var defaultPasswordHash = AuthController.HashPassword("Admin@123");
        var users = new List<User>
        {
            new User { FullName = "Thalaimalai", Username = "Thalaimalai", UserGroup = "Naren-Marketing", Role = "-", Status = "Active", PasswordHash = defaultPasswordHash },
            new User { FullName = "Saravanan", Username = "Saravanan", UserGroup = "Naren Marketing", Role = "-", Status = "Active", PasswordHash = defaultPasswordHash },
            new User { FullName = "Vasanth", Username = "Vasanth", UserGroup = "Naren-Store-Admin", Role = "-", Status = "Active", PasswordHash = defaultPasswordHash },
            new User { FullName = "ntesales", Username = "Krishna", UserGroup = "Naren-Store-Admin", Role = "-", Status = "Active", PasswordHash = defaultPasswordHash },
            new User { FullName = "Balasubramaniam", Username = "Bala", UserGroup = "Naren-Marketing", Role = "-", Status = "Inactive", PasswordHash = defaultPasswordHash },
            new User { FullName = "Senthil", Username = "Senthil", UserGroup = "Naren-Marketing", Role = "-", Status = "Inactive", PasswordHash = defaultPasswordHash },
            new User { FullName = "Venkatesan", Username = "Venkatesan", UserGroup = "Naren-Marketing", Role = "-", Status = "Inactive", PasswordHash = defaultPasswordHash },
            new User { FullName = "snathan", Username = "Senthilnathan", UserGroup = "Naren Admin", Role = "-", Status = "Active", PasswordHash = defaultPasswordHash },
            new User { FullName = "archana", Username = "Archana", UserGroup = "Naren-Accounts", Role = "-", Status = "Inactive", PasswordHash = defaultPasswordHash },
            new User { FullName = "rohini", Username = "Rohini", UserGroup = "Naren Admin", Role = "-", Status = "Active", PasswordHash = defaultPasswordHash }
        };
        dbContext.Users.AddRange(users);
        dbContext.SaveChanges();
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAngularPwa");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
