using ExhibitionLeads.Core.Entities;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExhibitionLeads.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SmtpController : ControllerBase
{
    private readonly AppDbContext _context;

    public SmtpController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{userId}")]
    public async Task<ActionResult<SmtpConfig>> GetSmtpConfig(string userId)
    {
        var config = await _context.SmtpConfigs.FirstOrDefaultAsync(c => c.UserId == userId);
        if (config == null)
        {
            config = new SmtpConfig
            {
                UserId = userId,
                SmtpHost = "smtp.gmail.com",
                Port = 587,
                Username = userId == "default" ? "notifications@ariyai.com" : $"{userId.ToLower()}@ariyai.com",
                FromName = userId,
                FromEmail = userId == "default" ? "notifications@ariyai.com" : $"{userId.ToLower()}@ariyai.com",
                EnableSsl = true
            };
        }
        return Ok(config);
    }

    [HttpPost]
    public async Task<IActionResult> SaveSmtpConfig([FromBody] SmtpConfig config)
    {
        var existing = await _context.SmtpConfigs.FirstOrDefaultAsync(c => c.UserId == config.UserId);
        if (existing != null)
        {
            existing.SmtpHost = config.SmtpHost;
            existing.Port = config.Port;
            existing.Username = config.Username;
            if (!string.IsNullOrWhiteSpace(config.Password)) existing.Password = config.Password;
            existing.FromName = config.FromName;
            existing.FromEmail = config.FromEmail;
            existing.EnableSsl = config.EnableSsl;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _context.SmtpConfigs.Add(config);
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "SMTP settings saved successfully per user login." });
    }
}
