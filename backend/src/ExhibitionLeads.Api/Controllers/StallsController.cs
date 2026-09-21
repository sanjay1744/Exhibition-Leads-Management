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
        Guid? ExhibitionId = null,
        string? MarketingRepIds = null,
        string? MarketingRepNames = null
    );

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StallDto>>> GetStalls(
        [FromQuery] string? ownerId, 
        [FromQuery] string? exhibitionId,
        [FromHeader(Name = "X-User-Role")] string? requestingRole,
        [FromHeader(Name = "X-User-Id")] string? requestingUserId,
        [FromHeader(Name = "X-User-Name")] string? requestingUserName)
    {
        var query = _context.Stalls.AsQueryable();

        // If StallOwner is calling, strictly restrict to stalls mapped to this stall owner
        if (!string.IsNullOrEmpty(requestingRole) && 
            string.Equals(requestingRole, "StallOwner", StringComparison.OrdinalIgnoreCase))
        {
            var parsedGuid = Guid.TryParse(requestingUserId, out var reqOwnerGuid);
            var reqUserLower = requestingUserName?.Trim().ToLower() ?? "";

            query = query.Where(s => 
                (parsedGuid && s.OwnerId == reqOwnerGuid) ||
                (!string.IsNullOrEmpty(reqUserLower) && s.OwnerName.ToLower() == reqUserLower)
            );
        }
        else if (!string.IsNullOrEmpty(requestingRole) && 
            string.Equals(requestingRole, "Marketing", StringComparison.OrdinalIgnoreCase))
        {
            var reqIdLower = requestingUserId?.Trim().ToLower() ?? "";
            var reqNameLower = requestingUserName?.Trim().ToLower() ?? "";

            query = query.Where(s => 
                (!string.IsNullOrEmpty(reqIdLower) && (s.MarketingRepIds ?? "").ToLower().Contains(reqIdLower)) ||
                (!string.IsNullOrEmpty(reqNameLower) && (s.MarketingRepNames ?? "").ToLower().Contains(reqNameLower))
            );
        }
        else if (!string.IsNullOrEmpty(ownerId) && Guid.TryParse(ownerId, out var oGuid))
        {
            query = query.Where(s => s.OwnerId == oGuid);
        }

        if (!string.IsNullOrEmpty(exhibitionId) && Guid.TryParse(exhibitionId, out var eGuid))
        {
            query = query.Where(s => s.ExhibitionId == eGuid);
        }

        var stalls = await query.OrderByDescending(s => s.CreatedAt).ToListAsync();
        Dictionary<Guid, int> leadCounts = new();
        try
        {
            leadCounts = await _context.Leads
                .GroupBy(l => l.StallId)
                .Select(g => new { StallId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.StallId, x => x.Count);
        }
        catch { }

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
            s.ExhibitionId,
            s.MarketingRepIds,
            s.MarketingRepNames
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
        object? Id,
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
        Guid? ExhibitionId,
        string? MarketingRepIds = null,
        string? MarketingRepNames = null
    );

    [HttpPost]
    public async Task<ActionResult<Stall>> CreateStall([FromBody] CreateStallRequest request, [FromHeader(Name = "X-User-Role")] string? requestingRole)
    {
        // Matrix: CREATE STALL - Super Admin: TRUE, Admin: TRUE, Stall Owner: FALSE, Marketing: FALSE
        if (!string.IsNullOrEmpty(requestingRole) && 
            !string.Equals(requestingRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(requestingRole, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { message = "Only Super Admin and Admin can create stalls." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Stall Name is required." });
        }

        Guid stallId = Guid.NewGuid();
        if (request.Id != null && Guid.TryParse(request.Id.ToString(), out var parsedStallGuid) && parsedStallGuid != Guid.Empty)
        {
            stallId = parsedStallGuid;
        }

        var code = request.Code?.Trim();
        if (string.IsNullOrWhiteSpace(code))
        {
            var year = DateTime.UtcNow.Year;
            var count = await _context.Stalls.CountAsync() + 1;
            code = $"STL-{year}-{count:D3}";
        }

        Guid ownerGuid = Guid.NewGuid();
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

        // Check if stall with same ID or Code already exists (upsert instead of conflict)
        var existing = await _context.Stalls.FirstOrDefaultAsync(s => s.Id == stallId || (!string.IsNullOrEmpty(code) && s.Code == code));
        if (existing != null)
        {
            existing.Name = request.Name.Trim();
            if (!string.IsNullOrWhiteSpace(code)) existing.Code = code;
            existing.ExhibitionId = exh?.Id ?? request.ExhibitionId;
            existing.EventName = exh != null ? exh.Name : (!string.IsNullOrWhiteSpace(request.EventName) ? request.EventName.Trim() : request.Name.Trim());
            existing.Organizer = exh != null ? exh.Organizer : (!string.IsNullOrWhiteSpace(request.Organizer) ? request.Organizer.Trim() : string.Empty);
            existing.DurationDays = duration;
            existing.StartDate = exh != null ? exh.StartDate : (request.StartDate ?? DateTime.UtcNow.Date);
            existing.EndDate = exh != null ? exh.EndDate : (request.EndDate ?? DateTime.UtcNow.Date.AddDays(duration));
            existing.Location = exh != null ? exh.Venue : (!string.IsNullOrWhiteSpace(request.Location) ? request.Location.Trim() : string.Empty);
            existing.HallNumber = !string.IsNullOrWhiteSpace(request.HallNumber) ? request.HallNumber.Trim() : string.Empty;
            existing.BoothNumber = !string.IsNullOrWhiteSpace(request.BoothNumber) ? request.BoothNumber.Trim() : string.Empty;
            existing.OwnerId = ownerGuid;
            existing.OwnerName = !string.IsNullOrWhiteSpace(request.OwnerName) ? request.OwnerName.Trim() : string.Empty;
            existing.MarketingRepIds = !string.IsNullOrWhiteSpace(request.MarketingRepIds) ? request.MarketingRepIds.Trim() : string.Empty;
            existing.MarketingRepNames = !string.IsNullOrWhiteSpace(request.MarketingRepNames) ? request.MarketingRepNames.Trim() : string.Empty;
            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        if (exh != null)
        {
            var match = System.Text.RegularExpressions.Regex.Match(exh.Code, @"EXH-STL(\d+)-", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            int maxAllowed = match.Success && int.TryParse(match.Groups[1].Value, out var parsedLimit) ? parsedLimit : 1;
            var currentCount = await _context.Stalls.CountAsync(s => s.ExhibitionId == exh.Id);
            if (currentCount >= maxAllowed)
            {
                return BadRequest(new { 
                    message = $"Exhibition '{exh.Name}' has reached its maximum stall quota of {maxAllowed} stall(s) ({currentCount} already assigned). Please edit the exhibition in Exhibition Master to increase 'No of stalls'." 
                });
            }
        }

        var stall = new Stall
        {
            Id = stallId,
            Name = request.Name.Trim(),
            Code = code,
            ExhibitionId = exh?.Id ?? request.ExhibitionId,
            EventName = exh != null ? exh.Name : (!string.IsNullOrWhiteSpace(request.EventName) ? request.EventName.Trim() : request.Name.Trim()),
            Organizer = exh != null ? exh.Organizer : (!string.IsNullOrWhiteSpace(request.Organizer) ? request.Organizer.Trim() : string.Empty),
            DurationDays = duration,
            StartDate = exh != null ? exh.StartDate : (request.StartDate ?? DateTime.UtcNow.Date),
            EndDate = exh != null ? exh.EndDate : (request.EndDate ?? DateTime.UtcNow.Date.AddDays(duration)),
            Location = exh != null ? exh.Venue : (!string.IsNullOrWhiteSpace(request.Location) ? request.Location.Trim() : string.Empty),
            HallNumber = !string.IsNullOrWhiteSpace(request.HallNumber) ? request.HallNumber.Trim() : string.Empty,
            BoothNumber = !string.IsNullOrWhiteSpace(request.BoothNumber) ? request.BoothNumber.Trim() : string.Empty,
            OwnerId = ownerGuid,
            OwnerName = !string.IsNullOrWhiteSpace(request.OwnerName) ? request.OwnerName.Trim() : string.Empty,
            MarketingRepIds = !string.IsNullOrWhiteSpace(request.MarketingRepIds) ? request.MarketingRepIds.Trim() : string.Empty,
            MarketingRepNames = !string.IsNullOrWhiteSpace(request.MarketingRepNames) ? request.MarketingRepNames.Trim() : string.Empty,
            Status = "Active"
        };

        _context.Stalls.Add(stall);
        await _context.SaveChangesAsync();

        return Ok(stall);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateStall(
        Guid id, 
        [FromBody] CreateStallRequest request, 
        [FromHeader(Name = "X-User-Role")] string? requestingRole,
        [FromHeader(Name = "X-User-Id")] string? requestingUserId,
        [FromHeader(Name = "X-User-Name")] string? requestingUserName)
    {
        try
        {
            if (string.Equals(requestingRole, "Marketing", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(403, new { message = "Marketing Rep is restricted from updating stalls." });
            }

            var stall = await _context.Stalls.FindAsync(id);
            if (stall == null)
            {
                var code = !string.IsNullOrWhiteSpace(request.Code) ? request.Code.Trim() : $"STL-{DateTime.UtcNow.Year}-001";
                if (await _context.Stalls.AnyAsync(s => s.Code == code && s.Id != id))
                {
                    code = $"{code}-{Guid.NewGuid().ToString()[..4]}";
                }
                stall = new Stall
                {
                    Id = id,
                    Name = !string.IsNullOrWhiteSpace(request.Name) ? request.Name.Trim() : "Stall",
                    Code = code,
                    OwnerId = Guid.NewGuid(),
                    Status = "Active",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Stalls.Add(stall);
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(request.Name)) stall.Name = request.Name.Trim();
                if (!string.IsNullOrWhiteSpace(request.Code)) stall.Code = request.Code.Trim();
            }

            // If StallOwner is calling, ensure the stall is mapped to them
            if (string.Equals(requestingRole, "StallOwner", StringComparison.OrdinalIgnoreCase))
            {
                var parsedGuid = Guid.TryParse(requestingUserId, out var reqOwnerGuid);
                var reqUserLower = requestingUserName?.Trim().ToLower() ?? "";
                bool isMapped = (parsedGuid && stall.OwnerId == reqOwnerGuid) ||
                                (!string.IsNullOrEmpty(reqUserLower) && stall.OwnerName.Equals(reqUserLower, StringComparison.OrdinalIgnoreCase));
                if (!isMapped)
                {
                    return StatusCode(403, new { message = "You can only edit stalls mapped to your account." });
                }
            }

            stall.ExhibitionId = request.ExhibitionId.HasValue && request.ExhibitionId.Value != Guid.Empty
                ? request.ExhibitionId.Value
                : null;

            if (stall.ExhibitionId.HasValue)
            {
                var exh = await _context.Exhibitions.FindAsync(stall.ExhibitionId.Value);
                if (exh != null)
                {
                    var match = System.Text.RegularExpressions.Regex.Match(exh.Code, @"EXH-STL(\d+)-", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    int maxAllowed = match.Success && int.TryParse(match.Groups[1].Value, out var parsedLimit) ? parsedLimit : 1;
                    var currentCount = await _context.Stalls.CountAsync(s => s.ExhibitionId == exh.Id && s.Id != stall.Id);
                    if (currentCount >= maxAllowed)
                    {
                        return BadRequest(new { 
                            message = $"Exhibition '{exh.Name}' has reached its maximum stall quota of {maxAllowed} stall(s) ({currentCount} already assigned). Please edit the exhibition in Exhibition Master to increase 'No of stalls'." 
                        });
                    }
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
            if (request.MarketingRepIds != null) stall.MarketingRepIds = request.MarketingRepIds.Trim();
            if (request.MarketingRepNames != null) stall.MarketingRepNames = request.MarketingRepNames.Trim();
            
            // Matrix Row 26: ASSIGN A STALL MASTER TO A STALL - Super Admin: TRUE, Admin: TRUE, Stall Owner: FALSE
            if (!string.Equals(requestingRole, "StallOwner", StringComparison.OrdinalIgnoreCase))
            {
                if (request.OwnerId != null && Guid.TryParse(request.OwnerId.ToString(), out var parsedOwnerGuid))
                {
                    stall.OwnerId = parsedOwnerGuid;
                }
                if (!string.IsNullOrWhiteSpace(request.OwnerName)) stall.OwnerName = request.OwnerName;
            }

            await _context.SaveChangesAsync();
            return Ok(stall);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { 
                message = ex.Message, 
                inner = ex.InnerException?.Message,
                details = ex.StackTrace 
            });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteStall(Guid id, [FromHeader(Name = "X-User-Role")] string? requestingRole)
    {
        // Matrix: DELETE STALL - Super Admin: TRUE, Admin: TRUE, Stall Owner: FALSE, Marketing: FALSE
        if (!string.IsNullOrEmpty(requestingRole) && 
            !string.Equals(requestingRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(requestingRole, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(403, new { message = "Only Super Admin and Admin can delete stalls." });
        }

        var stall = await _context.Stalls.FindAsync(id);
        if (stall == null) return NotFound(new { message = "Stall not found." });

        _context.Stalls.Remove(stall);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Stall deleted successfully." });
    }
}
