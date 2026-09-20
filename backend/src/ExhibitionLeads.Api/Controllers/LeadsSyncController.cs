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

using ExhibitionLeads.Api.Services;

namespace ExhibitionLeads.Api.Controllers;

public class SyncLeadDto
{
    public object? Id { get; set; }
    public string? LeadNumber { get; set; }
    public object? ExhibitionId { get; set; }
    public object? RepId { get; set; }
    public object? StallId { get; set; }
    public object? CapturedByUserId { get; set; }
    public string? Name { get; set; }
    public string? Company { get; set; }
    public string? Designation { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Website { get; set; }
    public string? Address { get; set; }
    public string? CaptureMethod { get; set; }
    public string? PhotoDataUrl { get; set; }
    public string? VoiceAudioUrl { get; set; }
    public string? VoiceUrl { get; set; }
    public string? VoiceNotesTranscript { get; set; }
    public string? InterestLevel { get; set; }
    public string[]? ProductCategory { get; set; }
    public string? Priority { get; set; }
    public decimal? Budget { get; set; }
    public string? PurchaseTimeline { get; set; }
    public DateTimeOffset? FollowUpDate { get; set; }
    public string? Remarks { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}

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
    private readonly SupabaseCloudService _supabaseService;

    public LeadsSyncController(AppDbContext dbContext, IWebHostEnvironment env, SupabaseCloudService supabaseService)
    {
        _dbContext = dbContext;
        _env = env;
        _supabaseService = supabaseService;
    }

    private static Guid ParseGuid(object? value)
    {
        if (value == null) return Guid.Empty;
        var str = value.ToString()?.Trim();
        if (string.IsNullOrEmpty(str)) return Guid.Empty;
        return Guid.TryParse(str, out var parsed) ? parsed : Guid.Empty;
    }

    [HttpPost("sync")]
    public async Task<IActionResult> BatchSync([FromBody] SyncBatchRequestDto request)
    {
        if (request?.Leads == null || !request.Leads.Any())
        {
            return BadRequest(new { message = "Payload contains no leads to sync." });
        }

        var syncedIds = new List<Guid>();
        var savedLeads = new List<Lead>();

        try
        {
            foreach (var item in request.Leads)
            {
                var leadId = ParseGuid(item.Id);
                if (leadId == Guid.Empty)
                {
                    leadId = Guid.NewGuid();
                }

                var assignedLeadNumber = item.LeadNumber;
                if (string.IsNullOrWhiteSpace(assignedLeadNumber))
                {
                    var count = await _dbContext.Leads.CountAsync() + 1;
                    assignedLeadNumber = $"S1L{count:D5}";
                }

                var stallId = ParseGuid(item.StallId);
                var exhId = ParseGuid(item.ExhibitionId);
                var repId = ParseGuid(item.RepId);
                var capturedBy = ParseGuid(item.CapturedByUserId);

                // If stallId is provided but exhibitionId is empty, look up stall's ExhibitionId
                if (exhId == Guid.Empty && stallId != Guid.Empty)
                {
                    var stall = await _dbContext.Stalls.AsNoTracking().FirstOrDefaultAsync(s => s.Id == stallId);
                    if (stall != null && stall.ExhibitionId.HasValue)
                    {
                        exhId = stall.ExhibitionId.Value;
                    }
                }

                // If exhibitionId was actually pointing to a stall (due to UI fallback), resolve stall
                if (stallId == Guid.Empty && exhId != Guid.Empty)
                {
                    var stall = await _dbContext.Stalls.AsNoTracking().FirstOrDefaultAsync(s => s.Id == exhId);
                    if (stall != null)
                    {
                        stallId = stall.Id;
                        if (stall.ExhibitionId.HasValue)
                        {
                            exhId = stall.ExhibitionId.Value;
                        }
                    }
                }

                var existingLead = await _dbContext.Leads
                    .FirstOrDefaultAsync(l => (leadId != Guid.Empty && l.Id == leadId) 
                        || (!string.IsNullOrEmpty(item.LeadNumber) && l.LeadNumber == item.LeadNumber) 
                        || (!string.IsNullOrEmpty(item.Phone) && l.Phone == item.Phone && l.Email == item.Email));

                var savedPhotoUrl = SaveCardImageFromBase64(item.PhotoDataUrl, assignedLeadNumber);

                if (existingLead != null)
                {
                    // Deduplicate & Update existing record
                    if (!string.IsNullOrWhiteSpace(item.LeadNumber))
                    {
                        existingLead.LeadNumber = item.LeadNumber;
                    }
                    if (!string.IsNullOrWhiteSpace(item.Name)) existingLead.Name = item.Name;
                    if (item.Company != null) existingLead.Company = item.Company;
                    if (item.Designation != null) existingLead.Designation = item.Designation;
                    if (!string.IsNullOrWhiteSpace(item.Phone)) existingLead.Phone = item.Phone;
                    if (item.Email != null) existingLead.Email = item.Email;
                    if (item.Website != null) existingLead.Website = item.Website;
                    if (item.Address != null) existingLead.Address = item.Address;
                    if (stallId != Guid.Empty) existingLead.StallId = stallId;
                    if (exhId != Guid.Empty) existingLead.ExhibitionId = exhId;
                    if (repId != Guid.Empty) existingLead.RepId = repId;
                    if (!string.IsNullOrWhiteSpace(item.InterestLevel)) existingLead.InterestLevel = item.InterestLevel;
                    if (!string.IsNullOrWhiteSpace(item.Priority)) existingLead.Priority = item.Priority;
                    if (item.Remarks != null) existingLead.Remarks = item.Remarks;
                    if (!string.IsNullOrEmpty(savedPhotoUrl))
                    {
                        existingLead.PhotoUrl = savedPhotoUrl;
                    }
                    if (!string.IsNullOrEmpty(item.VoiceAudioUrl ?? item.VoiceUrl))
                    {
                        existingLead.VoiceUrl = item.VoiceAudioUrl ?? item.VoiceUrl;
                    }
                    if (!string.IsNullOrEmpty(item.VoiceNotesTranscript))
                    {
                        existingLead.VoiceNotesTranscript = item.VoiceNotesTranscript;
                    }
                    existingLead.UpdatedAt = DateTimeOffset.UtcNow;
                    savedLeads.Add(existingLead);
                }
                else
                {
                    // Insert new lead record
                    var newLead = new Lead
                    {
                        Id = leadId,
                        LeadNumber = assignedLeadNumber,
                        ExhibitionId = exhId,
                        RepId = repId,
                        StallId = stallId,
                        CapturedByUserId = capturedBy != Guid.Empty ? capturedBy : repId,
                        Name = !string.IsNullOrWhiteSpace(item.Name) ? item.Name : "Visitor",
                        Company = item.Company ?? string.Empty,
                        Designation = item.Designation,
                        Phone = item.Phone ?? string.Empty,
                        Email = item.Email,
                        Website = item.Website,
                        Address = item.Address,
                        CaptureMethod = item.CaptureMethod ?? "manual",
                        PhotoUrl = savedPhotoUrl,
                        VoiceUrl = item.VoiceAudioUrl ?? item.VoiceUrl,
                        VoiceNotesTranscript = item.VoiceNotesTranscript,
                        InterestLevel = !string.IsNullOrWhiteSpace(item.InterestLevel) ? item.InterestLevel : "Warm",
                        ProductCategory = item.ProductCategory ?? Array.Empty<string>(),
                        Priority = !string.IsNullOrWhiteSpace(item.Priority) ? item.Priority : "Medium",
                        Budget = item.Budget,
                        PurchaseTimeline = item.PurchaseTimeline,
                        FollowUpDate = item.FollowUpDate,
                        Remarks = item.Remarks,
                        CreatedAt = item.CreatedAt ?? DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };

                    await _dbContext.Leads.AddAsync(newLead);
                    savedLeads.Add(newLead);
                }

                syncedIds.Add(leadId);
            }

            await _dbContext.SaveChangesAsync();

            // Mirror saved leads to Supabase cloud database
            foreach (var lead in savedLeads)
            {
                try
                {
                    await _supabaseService.SyncLeadAsync(lead);
                }
                catch {}
            }

            return Ok(new SyncBatchResponseDto(
                Success: true,
                SyncedCount: syncedIds.Count,
                SyncedIds: syncedIds
            ));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lead sync failed: " + ex.Message, details = ex.ToString() });
        }
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

    [HttpPost("save-audio-local")]
    public IActionResult SaveAudioLocal([FromBody] SaveAudioLocalRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request?.LeadNumber) || string.IsNullOrWhiteSpace(request?.AudioDataUrl))
        {
            return BadRequest(new { message = "LeadNumber and AudioDataUrl are required." });
        }

        try
        {
            var base64Data = request.AudioDataUrl.Contains("base64,") ? request.AudioDataUrl.Split("base64,")[1] : request.AudioDataUrl;
            var bytes = Convert.FromBase64String(base64Data);

            var ext = ".webm";
            if (request.AudioDataUrl.Contains("audio/mp4") || request.AudioDataUrl.Contains("audio/m4a")) ext = ".m4a";
            else if (request.AudioDataUrl.Contains("audio/wav")) ext = ".wav";
            else if (request.AudioDataUrl.Contains("audio/ogg")) ext = ".ogg";

            var myMusic = Environment.GetFolderPath(Environment.SpecialFolder.MyMusic);
            if (string.IsNullOrWhiteSpace(myMusic)) myMusic = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            
            var deviceFolder = !string.IsNullOrWhiteSpace(request.TargetFolder) 
                ? request.TargetFolder 
                : Path.Combine(myMusic, "Exhibition_Voice_Audio");

            if (!Directory.Exists(deviceFolder))
            {
                Directory.CreateDirectory(deviceFolder);
            }

            var fileName = $"{request.LeadNumber}{ext}";
            var filePath = Path.Combine(deviceFolder, fileName);
            System.IO.File.WriteAllBytes(filePath, bytes);

            var rootPath = _env.WebRootPath;
            if (string.IsNullOrEmpty(rootPath))
            {
                rootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            }
            var wwwrootFolder = Path.Combine(rootPath, "uploads", "voice_audio");
            if (!Directory.Exists(wwwrootFolder))
            {
                Directory.CreateDirectory(wwwrootFolder);
            }
            System.IO.File.WriteAllBytes(Path.Combine(wwwrootFolder, fileName), bytes);

            return Ok(new { 
                success = true, 
                leadNumber = request.LeadNumber, 
                savedDevicePath = filePath,
                webUrl = $"/uploads/voice_audio/{fileName}"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Failed to write audio to device folder: {ex.Message}" });
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

public record SaveAudioLocalRequestDto(
    string LeadNumber,
    string AudioDataUrl,
    string? TargetFolder = null
);
