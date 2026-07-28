using System;

namespace ExhibitionLeads.Core.Entities;

public class Stall
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty; // e.g. "Stall 01 - SIMA TexFair"
    public string Code { get; set; } = string.Empty; // e.g. "STL-2026-001"
    public string EventName { get; set; } = string.Empty; // e.g. "International TexFair 2026"
    public string Organizer { get; set; } = string.Empty; // Who is conducting, e.g. "SIMA Association"
    public int DurationDays { get; set; } = 3;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string Location { get; set; } = string.Empty; // e.g. "Codissia Trade Fair Complex, Coimbatore"
    public string HallNumber { get; set; } = string.Empty; // e.g. "Hall A"
    public string BoothNumber { get; set; } = string.Empty; // e.g. "Booth 12"
    public Guid OwnerId { get; set; } // Stall Owner User Id
    public string OwnerName { get; set; } = string.Empty;
    public string Status { get; set; } = "Active"; // Active, Closed, Upcoming
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
