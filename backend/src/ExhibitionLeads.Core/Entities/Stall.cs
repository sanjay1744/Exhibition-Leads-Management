using System;

namespace ExhibitionLeads.Core.Entities;

public class Stall
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty; // e.g. "Stall 01 - Tech Expo 2026"
    public string Code { get; set; } = string.Empty; // e.g. "STALL-01"
    public string Location { get; set; } = string.Empty; // e.g. "Hall A, Booth 12"
    public Guid OwnerId { get; set; } // Stall Owner User Id
    public string OwnerName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
