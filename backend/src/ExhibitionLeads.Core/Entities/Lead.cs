using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ExhibitionLeads.Core.Entities;

[Table("Leads")]
public class Lead
{
    [Key]
    public Guid Id { get; set; }

    public Guid ExhibitionId { get; set; }

    public Guid RepId { get; set; }

    public Guid StallId { get; set; } // Foreign key to Stall (Project) for strict data isolation

    public Guid CapturedByUserId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Company { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? Designation { get; set; }

    [Required]
    [MaxLength(50)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? Email { get; set; }

    [MaxLength(250)]
    public string? Website { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [Required]
    [MaxLength(50)]
    public string CaptureMethod { get; set; } = "manual";

    public string? PhotoUrl { get; set; }

    public string? VoiceUrl { get; set; }

    public string? VoiceNotesTranscript { get; set; }

    [Required]
    [MaxLength(20)]
    public string InterestLevel { get; set; } = "Warm"; // Hot, Warm, Cold

    public string[] ProductCategory { get; set; } = Array.Empty<string>();

    [Required]
    [MaxLength(20)]
    public string Priority { get; set; } = "Medium";

    public decimal? Budget { get; set; }

    [MaxLength(100)]
    public string? PurchaseTimeline { get; set; }

    public DateTimeOffset? FollowUpDate { get; set; }

    public string? Remarks { get; set; }

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "New";

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
