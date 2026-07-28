using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ExhibitionLeads.Core.Entities;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace ExhibitionLeads.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public record LoginRequest(string Username, string Password);
    public record AuthResponse(string Token, string Username, string FullName, string Role, string UserGroup);

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Username and password are required." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
        
        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username or password." });
        }

        if (user.Status != "Active")
        {
            return StatusCode(403, new { message = "User account is inactive. Please contact system admin." });
        }

        user.LastLoginAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var token = GenerateJwtToken(user);

        return Ok(new AuthResponse(
            Token: token,
            Username: user.Username,
            FullName: user.FullName,
            Role: user.Role,
            UserGroup: user.UserGroup
        ));
    }

    private string GenerateJwtToken(User user)
    {
        var secretKey = _configuration["JwtSettings:Secret"] ?? "AriyAI_Super_Secret_JWT_Signing_Key_2026_Enterprise_Security!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Name, user.Username),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("UserGroup", user.UserGroup)
        };

        var token = new JwtSecurityToken(
            issuer: "AriyAI.ExhibitionLeads",
            audience: "AriyAI.Client",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password + "AriyAISalt2026"));
        return Convert.ToBase64String(hashedBytes);
    }

    public static bool VerifyPassword(string password, string storedHash)
    {
        return HashPassword(password) == storedHash;
    }
}
