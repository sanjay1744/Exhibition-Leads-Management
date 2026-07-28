using System;

namespace ExhibitionLeads.Core.Entities;

public class SmtpConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "default";
    public string SmtpHost { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public bool EnableSsl { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class NotificationConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "default";
    public string EventName { get; set; } = string.Empty;
    public bool EmailAlert { get; set; } = true;
    public bool InAppAlert { get; set; } = true;
    public string RecipientRole { get; set; } = "All";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
