using System;

namespace ExhibitionLeads.Core.Entities;

public class Exhibition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty; // e.g. "EXH-2026-001"
    public string Name { get; set; } = string.Empty; // e.g. "International TexFair 2026"
    public string Organizer { get; set; } = string.Empty; // e.g. "SIMA Association"
    public string Venue { get; set; } = string.Empty; // e.g. "Codissia Trade Fair Complex, Coimbatore"
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int DurationDays { get; set; } = 3;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Active"; // Upcoming, Active, Completed, Archived
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
