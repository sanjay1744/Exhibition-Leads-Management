using ExhibitionLeads.Core.Entities;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExhibitionLeads.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExhibitionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ExhibitionsController(AppDbContext context)
    {
        _context = context;
    }

    public record ExhibitionDto(
        Guid Id,
        string Code,
        string Name,
        string Organizer,
        string Venue,
        DateTime? StartDate,
        DateTime? EndDate,
        int DurationDays,
        string Description,
        string Status,
        DateTime CreatedAt,
        int StallCount,
        int LeadCount
    );

    public record InlineStallRequest(
        string Name,
        string? HallNumber,
        string? BoothNumber,
        object? OwnerId,
        string? OwnerName
    );

    public record CreateExhibitionRequest(
        string Name,
        string? Code,
        string? Organizer,
        string? Venue,
        DateTime? StartDate,
        DateTime? EndDate,
        int? DurationDays,
        string? Description,
        string? Status,
        List<InlineStallRequest>? InitialStalls
    );

    public record ExhibitionDetailDto(
        ExhibitionDto Exhibition,
        List<StallsController.StallDto> Stalls
    );

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExhibitionDto>>> GetExhibitions([FromQuery] string? status)
    {
        var query = _context.Exhibitions.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(e => e.Status.ToLower() == status.ToLower());
        }

        var exhibitions = await query.OrderByDescending(e => e.StartDate ?? e.CreatedAt).ToListAsync();

        var stallCounts = await _context.Stalls
            .Where(s => s.ExhibitionId != null)
            .GroupBy(s => s.ExhibitionId!.Value)
            .Select(g => new { ExhibitionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ExhibitionId, x => x.Count);

        var leadCounts = await _context.Leads
            .GroupBy(l => l.ExhibitionId)
            .Select(g => new { ExhibitionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ExhibitionId, x => x.Count);

        var dtos = exhibitions.Select(e => new ExhibitionDto(
            e.Id,
            e.Code,
            e.Name,
            e.Organizer,
            e.Venue,
            e.StartDate,
            e.EndDate,
            e.DurationDays,
            e.Description,
            e.Status,
            e.CreatedAt,
            stallCounts.TryGetValue(e.Id, out var sCount) ? sCount : 0,
            leadCounts.TryGetValue(e.Id, out var lCount) ? lCount : 0
        ));

        return Ok(dtos);
    }

    [HttpGet("next-code")]
    public async Task<ActionResult<object>> GetNextExhibitionCode()
    {
        var year = DateTime.UtcNow.Year;
        var count = await _context.Exhibitions.CountAsync() + 1;
        var nextCode = $"EXH-{year}-{count:D3}";
        return Ok(new { code = nextCode });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ExhibitionDetailDto>> GetExhibitionById(Guid id)
    {
        var exhibition = await _context.Exhibitions.FindAsync(id);
        if (exhibition == null) return NotFound(new { message = "Exhibition not found." });

        var stalls = await _context.Stalls.Where(s => s.ExhibitionId == id).ToListAsync();
        var leadCounts = await _context.Leads
            .Where(l => l.ExhibitionId == id)
            .GroupBy(l => l.StallId)
            .Select(g => new { StallId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StallId, x => x.Count);

        var stallDtos = stalls.Select(s => new StallsController.StallDto(
            s.Id,
            s.Name,
            s.Code,
            s.EventName,
            s.Organizer,
            s.DurationDays,
            s.StartDate,
            s.EndDate,
            s.Location,
            s.HallNumber,
            s.BoothNumber,
            s.OwnerId,
            s.OwnerName,
            s.Status,
            s.CreatedAt,
            leadCounts.TryGetValue(s.Id, out var count) ? count : 0
        )).ToList();

        var totalLeads = await _context.Leads.CountAsync(l => l.ExhibitionId == id);

        var exhDto = new ExhibitionDto(
            exhibition.Id,
            exhibition.Code,
            exhibition.Name,
            exhibition.Organizer,
            exhibition.Venue,
            exhibition.StartDate,
            exhibition.EndDate,
            exhibition.DurationDays,
            exhibition.Description,
            exhibition.Status,
            exhibition.CreatedAt,
            stallDtos.Count,
            totalLeads
        );

        return Ok(new ExhibitionDetailDto(exhDto, stallDtos));
    }

    [HttpPost]
    public async Task<ActionResult<Exhibition>> CreateExhibition([FromBody] CreateExhibitionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Exhibition Name is required." });
        }

        var code = request.Code;
        if (string.IsNullOrWhiteSpace(code))
        {
            var year = DateTime.UtcNow.Year;
            var count = await _context.Exhibitions.CountAsync() + 1;
            code = $"EXH-{year}-{count:D3}";
        }

        if (await _context.Exhibitions.AnyAsync(e => e.Code == code))
        {
            var year = DateTime.UtcNow.Year;
            var count = await _context.Exhibitions.CountAsync() + 1;
            code = $"EXH-{year}-{count:D3}-{Guid.NewGuid().ToString()[..4]}";
        }

        var duration = request.DurationDays.HasValue && request.DurationDays.Value > 0 ? request.DurationDays.Value : 3;

        var exhibition = new Exhibition
        {
            Code = code,
            Name = request.Name.Trim(),
            Organizer = !string.IsNullOrWhiteSpace(request.Organizer) ? request.Organizer.Trim() : "Standard Event Organizer",
            Venue = !string.IsNullOrWhiteSpace(request.Venue) ? request.Venue.Trim() : "Trade Center Complex",
            StartDate = request.StartDate ?? DateTime.UtcNow.Date,
            EndDate = request.EndDate ?? DateTime.UtcNow.Date.AddDays(duration),
            DurationDays = duration,
            Description = request.Description ?? string.Empty,
            Status = !string.IsNullOrWhiteSpace(request.Status) ? request.Status : "Active"
        };

        _context.Exhibitions.Add(exhibition);
        await _context.SaveChangesAsync();

        // Create inline initial stalls if provided
        if (request.InitialStalls != null && request.InitialStalls.Count > 0)
        {
            int stallIndex = await _context.Stalls.CountAsync() + 1;
            var year = DateTime.UtcNow.Year;

            foreach (var stReq in request.InitialStalls)
            {
                if (string.IsNullOrWhiteSpace(stReq.Name)) continue;

                Guid ownerGuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
                if (stReq.OwnerId != null && Guid.TryParse(stReq.OwnerId.ToString(), out var parsedGuid))
                {
                    ownerGuid = parsedGuid;
                }

                var stallCode = $"STL-{year}-{stallIndex:D3}";
                stallIndex++;

                var stall = new Stall
                {
                    Name = stReq.Name.Trim(),
                    Code = stallCode,
                    ExhibitionId = exhibition.Id,
                    EventName = exhibition.Name,
                    Organizer = exhibition.Organizer,
                    DurationDays = exhibition.DurationDays,
                    StartDate = exhibition.StartDate,
                    EndDate = exhibition.EndDate,
                    Location = exhibition.Venue,
                    HallNumber = !string.IsNullOrWhiteSpace(stReq.HallNumber) ? stReq.HallNumber : "Hall A",
                    BoothNumber = !string.IsNullOrWhiteSpace(stReq.BoothNumber) ? stReq.BoothNumber : "Booth 01",
                    OwnerId = ownerGuid,
                    OwnerName = !string.IsNullOrWhiteSpace(stReq.OwnerName) ? stReq.OwnerName : "Thalaimalai",
                    Status = "Active"
                };

                _context.Stalls.Add(stall);
            }
            await _context.SaveChangesAsync();
        }

        return Ok(exhibition);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateExhibition(Guid id, [FromBody] CreateExhibitionRequest request)
    {
        var exhibition = await _context.Exhibitions.FindAsync(id);
        if (exhibition == null) return NotFound(new { message = "Exhibition not found." });

        if (!string.IsNullOrWhiteSpace(request.Name)) exhibition.Name = request.Name.Trim();
        if (!string.IsNullOrWhiteSpace(request.Organizer)) exhibition.Organizer = request.Organizer.Trim();
        if (!string.IsNullOrWhiteSpace(request.Venue)) exhibition.Venue = request.Venue.Trim();
        if (request.StartDate.HasValue) exhibition.StartDate = request.StartDate.Value;
        if (request.EndDate.HasValue) exhibition.EndDate = request.EndDate.Value;
        if (request.DurationDays.HasValue && request.DurationDays.Value > 0) exhibition.DurationDays = request.DurationDays.Value;
        if (request.Description != null) exhibition.Description = request.Description;
        if (!string.IsNullOrWhiteSpace(request.Status)) exhibition.Status = request.Status;

        await _context.SaveChangesAsync();

        // Also update linked stalls' EventName, Organizer, Venue, and Dates if changed
        var linkedStalls = await _context.Stalls.Where(s => s.ExhibitionId == id).ToListAsync();
        foreach (var s in linkedStalls)
        {
            s.EventName = exhibition.Name;
            s.Organizer = exhibition.Organizer;
            s.Location = exhibition.Venue;
            s.StartDate = exhibition.StartDate;
            s.EndDate = exhibition.EndDate;
            s.DurationDays = exhibition.DurationDays;
        }

        await _context.SaveChangesAsync();
        return Ok(exhibition);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteExhibition(Guid id)
    {
        var exhibition = await _context.Exhibitions.FindAsync(id);
        if (exhibition == null) return NotFound(new { message = "Exhibition not found." });

        // Unlink or remove linked stalls
        var linkedStalls = await _context.Stalls.Where(s => s.ExhibitionId == id).ToListAsync();
        foreach (var s in linkedStalls)
        {
            s.ExhibitionId = null; // Unlink stall
        }

        _context.Exhibitions.Remove(exhibition);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Exhibition deleted successfully." });
    }
}
