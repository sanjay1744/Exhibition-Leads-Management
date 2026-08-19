using ExhibitionLeads.Core.Entities;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExhibitionLeads.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<User>>> GetUsers()
    {
        return await _context.Users.OrderBy(u => u.FullName).ToListAsync();
    }

    public record CreateUserRequest(
        string FullName,
        string Username,
        string? Email,
        string? Password,
        string? UserGroup,
        string? Role,
        string? Status,
        Guid? AssignedStallId
    );

    [HttpPost]
    public async Task<ActionResult<User>> CreateUser([FromBody] CreateUserRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Username == request.Username))
        {
            return BadRequest(new { message = "Username already exists." });
        }

        var newUser = new User
        {
            FullName = request.FullName,
            Username = request.Username,
            Email = !string.IsNullOrWhiteSpace(request.Email) ? request.Email : $"{request.Username.ToLower()}@ariyai.com",
            PasswordHash = AuthController.HashPassword(string.IsNullOrEmpty(request.Password) ? "Admin@123" : request.Password),
            UserGroup = !string.IsNullOrWhiteSpace(request.UserGroup) ? request.UserGroup : "Naren-Marketing",
            Role = string.IsNullOrEmpty(request.Role) ? "Marketing" : request.Role,
            Status = string.IsNullOrEmpty(request.Status) ? "Active" : request.Status,
            AssignedStallId = request.AssignedStallId
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUsers), new { id = newUser.Id }, newUser);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] CreateUserRequest request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.FullName = request.FullName;
        if (!string.IsNullOrEmpty(request.UserGroup)) user.UserGroup = request.UserGroup;
        user.Role = string.IsNullOrEmpty(request.Role) ? user.Role : request.Role;
        if (!string.IsNullOrEmpty(request.Status)) user.Status = request.Status;
        if (request.AssignedStallId.HasValue) user.AssignedStallId = request.AssignedStallId;

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = AuthController.HashPassword(request.Password);
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(Guid id, [FromHeader(Name = "X-User-Role")] string? requestingRole)
    {
        // Enforce Hierarchy: Stall Owner cannot delete users
        if (string.Equals(requestingRole, "StallOwner", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { message = "Stall Owners are restricted from deleting users. Only Admin can delete users." });
        }

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] string newPassword)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.PasswordHash = AuthController.HashPassword(newPassword);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Password reset successfully." });
    }
}
