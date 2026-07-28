using System;

namespace ExhibitionLeads.Core.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string UserGroup { get; set; } = "Naren-Marketing";
    public string Role { get; set; } = "Marketing"; // Admin, StallOwner, Marketing
    public Guid? AssignedStallId { get; set; }
    public string Status { get; set; } = "Active"; // Active, Inactive
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}
