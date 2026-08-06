using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ExhibitionLeads.Core.Entities;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExhibitionLeads.Api.Controllers;

public record SyncLeadDto(
    Guid Id,
    string? LeadNumber,
    Guid ExhibitionId,
    Guid RepId,
    string Name,
    string Company,
    string? Designation,
    string Phone,
    string? Email,
    string? Website,
    string? Address,
    string CaptureMethod,
    string InterestLevel,
    string[] ProductCategory,
    string Priority,
    decimal? Budget,
    string? PurchaseTimeline,
    DateTimeOffset? FollowUpDate,
    string? Remarks,
    DateTimeOffset CreatedAt
);

public record SyncBatchRequestDto(
    List<SyncLeadDto> Leads
);

public record SyncBatchResponseDto(
    bool Success,
    int SyncedCount,
    List<Guid> SyncedIds
);

[ApiController]
[Route("api/v1/leads")]
public class LeadsSyncController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public LeadsSyncController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpPost("sync")]
    public async Task<IActionResult> BatchSync([FromBody] SyncBatchRequestDto request)
    {
        if (request?.Leads == null || !request.Leads.Any())
        {
            return BadRequest(new { message = "Payload contains no leads to sync." });
        }

        var syncedIds = new List<Guid>();

        foreach (var item in request.Leads)
        {
            var existingLead = await _dbContext.Leads
                .FirstOrDefaultAsync(l => l.Id == item.Id 
                    || (!string.IsNullOrEmpty(item.LeadNumber) && l.LeadNumber == item.LeadNumber) 
                    || (l.Phone == item.Phone && l.Email == item.Email));

            if (existingLead != null)
            {
                // Deduplicate & Update existing record
                if (!string.IsNullOrWhiteSpace(item.LeadNumber))
                {
                    existingLead.LeadNumber = item.LeadNumber;
                }
                existingLead.Name = item.Name;
                existingLead.Company = item.Company;
                existingLead.Designation = item.Designation ?? existingLead.Designation;
                existingLead.InterestLevel = item.InterestLevel;
                existingLead.Priority = item.Priority;
                existingLead.Remarks = item.Remarks ?? existingLead.Remarks;
                existingLead.UpdatedAt = DateTimeOffset.UtcNow;
            }
            else
            {
                var leadNumberToAssign = item.LeadNumber;
                if (string.IsNullOrWhiteSpace(leadNumberToAssign))
                {
                    var count = await _dbContext.Leads.CountAsync() + 1;
                    leadNumberToAssign = $"S1L{count:D5}";
                }

                // Insert new lead record
                var newLead = new Lead
                {
                    Id = item.Id == Guid.Empty ? Guid.NewGuid() : item.Id,
                    LeadNumber = leadNumberToAssign,
                    ExhibitionId = item.ExhibitionId,
                    RepId = item.RepId,
                    Name = item.Name,
                    Company = item.Company,
                    Designation = item.Designation,
                    Phone = item.Phone,
                    Email = item.Email,
                    Website = item.Website,
                    Address = item.Address,
                    CaptureMethod = item.CaptureMethod,
                    InterestLevel = item.InterestLevel,
                    ProductCategory = item.ProductCategory ?? Array.Empty<string>(),
                    Priority = item.Priority,
                    Budget = item.Budget,
                    PurchaseTimeline = item.PurchaseTimeline,
                    FollowUpDate = item.FollowUpDate,
                    Remarks = item.Remarks,
                    CreatedAt = item.CreatedAt,
                    UpdatedAt = DateTimeOffset.UtcNow
                };

                await _dbContext.Leads.AddAsync(newLead);
            }

            syncedIds.Add(item.Id);
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new SyncBatchResponseDto(
            Success: true,
            SyncedCount: syncedIds.Count,
            SyncedIds: syncedIds
        ));
    }
}
