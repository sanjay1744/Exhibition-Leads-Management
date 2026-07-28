using System;

namespace ExhibitionLeads.Core.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string UserGroup { get; set; } = "Naren-Marketing"; // e.g. Naren-Marketing, Naren-Store-Admin, Naren Admin
    public string Role { get; set; } = "User"; // Admin, Manager, User
    public string Status { get; set; } = "Active"; // Active, Inactive
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}
