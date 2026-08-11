using ExhibitionLeads.Core.Entities;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExhibitionLeads.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StallsController : ControllerBase
{
    private readonly AppDbContext _context;

    public StallsController(AppDbContext context)
    {
        _context = context;
    }

    public record StallDto(
        Guid Id,
        string Name,
        string Code,
        string EventName,
        string Organizer,
        int DurationDays,
        DateTime? StartDate,
        DateTime? EndDate,
        string Location,
        string HallNumber,
        string BoothNumber,
        Guid OwnerId,
        string OwnerName,
        string Status,
        DateTime CreatedAt,
        int LeadCount,
        Guid? ExhibitionId = null
    );

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StallDto>>> GetStalls([FromQuery] string? ownerId, [FromQuery] string? exhibitionId)
    {
        var query = _context.Stalls.AsQueryable();
        if (!string.IsNullOrEmpty(ownerId) && Guid.TryParse(ownerId, out var oGuid))
        {
            query = query.Where(s => s.OwnerId == oGuid);
        }
        if (!string.IsNullOrEmpty(exhibitionId) && Guid.TryParse(exhibitionId, out var eGuid))
        {
            query = query.Where(s => s.ExhibitionId == eGuid);
        }

        var stalls = await query.OrderByDescending(s => s.CreatedAt).ToListAsync();
        var leadCounts = await _context.Leads
            .GroupBy(l => l.StallId)
            .Select(g => new { StallId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StallId, x => x.Count);

        var dtos = stalls.Select(s => new StallDto(
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
            leadCounts.TryGetValue(s.Id, out var count) ? count : 0,
            s.ExhibitionId
        ));

        return Ok(dtos);
    }

    [HttpGet("next-code")]
    public async Task<ActionResult<object>> GetNextStallCode()
    {
        var year = DateTime.UtcNow.Year;
        var count = await _context.Stalls.CountAsync() + 1;
        var nextCode = $"STL-{year}-{count:D3}";
        return Ok(new { code = nextCode });
    }

    public record CreateStallRequest(
        string Name,
        string? Code,
        string? EventName,
        string? Organizer,
        int? DurationDays,
        DateTime? StartDate,
        DateTime? EndDate,
        string? Location,
        string? HallNumber,
        string? BoothNumber,
        object? OwnerId,
        string? OwnerName,
        Guid? ExhibitionId
    );

    [HttpPost]
    public async Task<ActionResult<Stall>> CreateStall([FromBody] CreateStallRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Stall Name is required." });
        }

        var code = request.Code;
        if (string.IsNullOrWhiteSpace(code))
        {
            var year = DateTime.UtcNow.Year;
            var count = await _context.Stalls.CountAsync() + 1;
            code = $"STL-{year}-{count:D3}";
        }

        if (await _context.Stalls.AnyAsync(s => s.Code == code))
        {
            var year = DateTime.UtcNow.Year;
            var count = await _context.Stalls.CountAsync() + 1;
            code = $"STL-{year}-{count:D3}-{Guid.NewGuid().ToString()[..4]}";
        }

        Guid ownerGuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
        if (request.OwnerId != null && Guid.TryParse(request.OwnerId.ToString(), out var parsedGuid))
        {
            ownerGuid = parsedGuid;
        }

        Exhibition? exh = null;
        if (request.ExhibitionId.HasValue && request.ExhibitionId.Value != Guid.Empty)
        {
            exh = await _context.Exhibitions.FindAsync(request.ExhibitionId.Value);
        }

        var duration = request.DurationDays.HasValue && request.DurationDays.Value > 0 
            ? request.DurationDays.Value 
            : (exh?.DurationDays ?? 4);

        var stall = new Stall
        {
            Name = request.Name,
            Code = code,
            ExhibitionId = exh?.Id ?? request.ExhibitionId,
            EventName = exh != null ? exh.Name : (!string.IsNullOrWhiteSpace(request.EventName) ? request.EventName : request.Name),
            Organizer = exh != null ? exh.Organizer : (!string.IsNullOrWhiteSpace(request.Organizer) ? request.Organizer : "Internal Exhibition Team"),
            DurationDays = duration,
            StartDate = exh != null ? exh.StartDate : (request.StartDate ?? DateTime.UtcNow.Date),
            EndDate = exh != null ? exh.EndDate : (request.EndDate ?? DateTime.UtcNow.Date.AddDays(duration)),
            Location = exh != null ? exh.Venue : (!string.IsNullOrWhiteSpace(request.Location) ? request.Location : "Main Convention Center"),
            HallNumber = !string.IsNullOrWhiteSpace(request.HallNumber) ? request.HallNumber : "Hall A",
            BoothNumber = !string.IsNullOrWhiteSpace(request.BoothNumber) ? request.BoothNumber : "Booth 01",
            OwnerId = ownerGuid,
            OwnerName = !string.IsNullOrWhiteSpace(request.OwnerName) ? request.OwnerName : "Thalaimalai",
            Status = "Active"
        };

        _context.Stalls.Add(stall);
        await _context.SaveChangesAsync();

        return Ok(stall);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateStall(Guid id, [FromBody] CreateStallRequest request)
    {
        var stall = await _context.Stalls.FindAsync(id);
        if (stall == null) return NotFound(new { message = "Stall not found." });

        stall.Name = request.Name;
        if (request.ExhibitionId.HasValue)
        {
            stall.ExhibitionId = request.ExhibitionId.Value;
            var exh = await _context.Exhibitions.FindAsync(request.ExhibitionId.Value);
            if (exh != null)
            {
                stall.EventName = exh.Name;
                stall.Organizer = exh.Organizer;
                stall.Location = exh.Venue;
                stall.StartDate = exh.StartDate;
                stall.EndDate = exh.EndDate;
                stall.DurationDays = exh.DurationDays;
            }
        }
        if (!string.IsNullOrWhiteSpace(request.EventName)) stall.EventName = request.EventName;
        if (!string.IsNullOrWhiteSpace(request.Organizer)) stall.Organizer = request.Organizer;
        if (request.DurationDays.HasValue && request.DurationDays.Value > 0) stall.DurationDays = request.DurationDays.Value;
        if (request.StartDate.HasValue) stall.StartDate = request.StartDate.Value;
        if (request.EndDate.HasValue) stall.EndDate = request.EndDate.Value;
        if (!string.IsNullOrWhiteSpace(request.Location)) stall.Location = request.Location;
        if (!string.IsNullOrWhiteSpace(request.HallNumber)) stall.HallNumber = request.HallNumber;
        if (!string.IsNullOrWhiteSpace(request.BoothNumber)) stall.BoothNumber = request.BoothNumber;
        if (!string.IsNullOrWhiteSpace(request.OwnerName)) stall.OwnerName = request.OwnerName;

        await _context.SaveChangesAsync();
        return Ok(stall);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteStall(Guid id)
    {
        var stall = await _context.Stalls.FindAsync(id);
        if (stall == null) return NotFound(new { message = "Stall not found." });

        _context.Stalls.Remove(stall);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Stall deleted successfully." });
    }
}
