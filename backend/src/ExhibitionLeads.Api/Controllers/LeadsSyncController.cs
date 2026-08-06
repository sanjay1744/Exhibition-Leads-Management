using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using ExhibitionLeads.Core.Entities;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
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
    string? PhotoDataUrl,
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
    private readonly IWebHostEnvironment _env;

    public LeadsSyncController(AppDbContext dbContext, IWebHostEnvironment env)
    {
        _dbContext = dbContext;
        _env = env;
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

            var assignedLeadNumber = item.LeadNumber;
            if (string.IsNullOrWhiteSpace(assignedLeadNumber))
            {
                var count = await _dbContext.Leads.CountAsync() + 1;
                assignedLeadNumber = $"S1L{count:D5}";
            }

            var savedPhotoUrl = SaveCardImageFromBase64(item.PhotoDataUrl, assignedLeadNumber);

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
                if (!string.IsNullOrEmpty(savedPhotoUrl))
                {
                    existingLead.PhotoUrl = savedPhotoUrl;
                }
                existingLead.UpdatedAt = DateTimeOffset.UtcNow;
            }
            else
            {
                // Insert new lead record
                var newLead = new Lead
                {
                    Id = item.Id == Guid.Empty ? Guid.NewGuid() : item.Id,
                    LeadNumber = assignedLeadNumber,
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
                    PhotoUrl = savedPhotoUrl,
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

    [HttpPost("save-image-local")]
    public IActionResult SaveImageLocal([FromBody] SaveImageLocalRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request?.LeadNumber) || string.IsNullOrWhiteSpace(request?.PhotoDataUrl))
        {
            return BadRequest(new { message = "LeadNumber and PhotoDataUrl are required." });
        }

        try
        {
            var base64Data = request.PhotoDataUrl.Contains("base64,") ? request.PhotoDataUrl.Split("base64,")[1] : request.PhotoDataUrl;
            var bytes = Convert.FromBase64String(base64Data);

            // Create dedicated device folder in MyPictures/Exhibition_Card_Images or project root
            var myPictures = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);
            var deviceFolder = !string.IsNullOrWhiteSpace(request.TargetFolder) 
                ? request.TargetFolder 
                : Path.Combine(myPictures, "Exhibition_Card_Images");

            if (!Directory.Exists(deviceFolder))
            {
                Directory.CreateDirectory(deviceFolder);
            }

            var fileName = $"{request.LeadNumber}.jpg";
            var filePath = Path.Combine(deviceFolder, fileName);
            System.IO.File.WriteAllBytes(filePath, bytes);

            // Also copy to wwwroot static uploads folder for web HTTP serving
            var rootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var wwwrootFolder = Path.Combine(rootPath, "uploads", "card_images");
            if (!Directory.Exists(wwwrootFolder))
            {
                Directory.CreateDirectory(wwwrootFolder);
            }
            System.IO.File.WriteAllBytes(Path.Combine(wwwrootFolder, fileName), bytes);

            return Ok(new { 
                success = true, 
                leadNumber = request.LeadNumber, 
                savedDevicePath = filePath,
                webUrl = $"/uploads/card_images/{fileName}"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Failed to write image to device folder: {ex.Message}" });
        }
    }

    private string? SaveCardImageFromBase64(string? photoDataUrl, string leadNumber)
    {
        if (string.IsNullOrWhiteSpace(photoDataUrl) || !photoDataUrl.Contains("base64,"))
            return null;

        try
        {
            var base64Data = photoDataUrl.Split("base64,")[1];
            var bytes = Convert.FromBase64String(base64Data);

            var rootPath = _env.WebRootPath;
            if (string.IsNullOrEmpty(rootPath))
            {
                rootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            }

            var folderPath = Path.Combine(rootPath, "uploads", "card_images");
            if (!Directory.Exists(folderPath))
            {
                Directory.CreateDirectory(folderPath);
            }

            var fileName = $"{leadNumber}.jpg";
            var filePath = Path.Combine(folderPath, fileName);
            System.IO.File.WriteAllBytes(filePath, bytes);

            // Also backup to dedicated device folder MyPictures/Exhibition_Card_Images
            try
            {
                var deviceFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), "Exhibition_Card_Images");
                if (!Directory.Exists(deviceFolder)) Directory.CreateDirectory(deviceFolder);
                System.IO.File.WriteAllBytes(Path.Combine(deviceFolder, fileName), bytes);
            }
            catch {}

            return $"/uploads/card_images/{fileName}";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeadsSyncController] Failed to save card image for {leadNumber}: {ex.Message}");
            return null;
        }
    }
}

public record SaveImageLocalRequestDto(
    string LeadNumber,
    string PhotoDataUrl,
    string? TargetFolder
);
