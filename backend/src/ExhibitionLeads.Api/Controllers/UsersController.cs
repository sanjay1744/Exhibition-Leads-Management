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

    private static bool CanCreateTargetRole(string? requestingRole, string targetRole)
    {
        if (string.IsNullOrEmpty(requestingRole)) return true;
        if (string.Equals(requestingRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase)) return true;

        if (string.Equals(requestingRole, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            // Admin can create Admin, StallOwner, Marketing (cannot create SuperAdmin)
            return !string.Equals(targetRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);
        }

        if (string.Equals(requestingRole, "StallOwner", StringComparison.OrdinalIgnoreCase))
        {
            // StallOwner can create StallOwner, Marketing
            return string.Equals(targetRole, "StallOwner", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(targetRole, "Marketing", StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    private static bool CanManageTargetUser(string? requestingRole, string targetRole)
    {
        if (string.IsNullOrEmpty(requestingRole)) return true;
        if (string.Equals(requestingRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase)) return true;

        if (string.Equals(requestingRole, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            // Admin can manage StallOwner and Marketing only (cannot edit/delete SuperAdmin or Admin)
            return string.Equals(targetRole, "StallOwner", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(targetRole, "Marketing", StringComparison.OrdinalIgnoreCase);
        }

        if (string.Equals(requestingRole, "StallOwner", StringComparison.OrdinalIgnoreCase))
        {
            // StallOwner can only edit/delete Marketing
            return string.Equals(targetRole, "Marketing", StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    [HttpPost]
    public async Task<ActionResult<User>> CreateUser([FromBody] CreateUserRequest request, [FromHeader(Name = "X-User-Role")] string? requestingRole)
    {
        var targetRole = string.IsNullOrEmpty(request.Role) ? "Marketing" : request.Role;

        if (!CanCreateTargetRole(requestingRole, targetRole))
        {
            return StatusCode(403, new { message = $"Your role '{requestingRole}' does not have permission to create '{targetRole}' users." });
        }

        if (await _context.Users.AnyAsync(u => u.Username == request.Username))
        {
            return BadRequest(new { message = "Username already exists." });
        }

        var newUser = new User
        {
            FullName = request.FullName,
            Username = request.Username,
            Email = !string.IsNullOrWhiteSpace(request.Email) ? request.Email.Trim() : string.Empty,
            PasswordHash = AuthController.HashPassword(string.IsNullOrEmpty(request.Password) ? "Admin@123" : request.Password),
            UserGroup = !string.IsNullOrWhiteSpace(request.UserGroup) ? request.UserGroup.Trim() : "Sales Team",
            Role = targetRole,
            Status = string.IsNullOrEmpty(request.Status) ? "Active" : request.Status,
            AssignedStallId = request.AssignedStallId
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUsers), new { id = newUser.Id }, newUser);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] CreateUserRequest request, [FromHeader(Name = "X-User-Role")] string? requestingRole)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (!CanManageTargetUser(requestingRole, user.Role))
        {
            return StatusCode(403, new { message = $"Your role '{requestingRole}' cannot modify '{user.Role}' accounts." });
        }

        if (!string.IsNullOrEmpty(request.Role) && !string.Equals(request.Role, user.Role, StringComparison.OrdinalIgnoreCase))
        {
            if (!CanCreateTargetRole(requestingRole, request.Role))
            {
                return StatusCode(403, new { message = $"Your role '{requestingRole}' cannot assign role '{request.Role}'." });
            }
            user.Role = request.Role;
        }

        user.FullName = request.FullName;
        if (!string.IsNullOrEmpty(request.UserGroup)) user.UserGroup = request.UserGroup;
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
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (!CanManageTargetUser(requestingRole, user.Role))
        {
            return StatusCode(403, new { message = $"Your role '{requestingRole}' cannot delete '{user.Role}' accounts." });
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] string newPassword, [FromHeader(Name = "X-User-Role")] string? requestingRole)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (!CanManageTargetUser(requestingRole, user.Role))
        {
            return StatusCode(403, new { message = $"Your role '{requestingRole}' cannot reset password for '{user.Role}' accounts." });
        }

        user.PasswordHash = AuthController.HashPassword(newPassword);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Password reset successfully." });
    }
}
