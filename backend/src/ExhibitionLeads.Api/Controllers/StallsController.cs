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

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Stall>>> GetStalls([FromQuery] string? ownerId)
    {
        var query = _context.Stalls.AsQueryable();
        if (!string.IsNullOrEmpty(ownerId) && Guid.TryParse(ownerId, out var oGuid))
        {
            query = query.Where(s => s.OwnerId == oGuid);
        }
        return await query.OrderBy(s => s.Name).ToListAsync();
    }

    public record CreateStallRequest(string Name, string Code, string Location, Guid OwnerId, string OwnerName);

    [HttpPost]
    public async Task<ActionResult<Stall>> CreateStall([FromBody] CreateStallRequest request)
    {
        if (await _context.Stalls.AnyAsync(s => s.Code == request.Code))
        {
            return BadRequest(new { message = "Stall code already exists." });
        }

        var stall = new Stall
        {
            Name = request.Name,
            Code = request.Code,
            Location = request.Location,
            OwnerId = request.OwnerId,
            OwnerName = request.OwnerName
        };

        _context.Stalls.Add(stall);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetStalls), new { id = stall.Id }, stall);
    }
}
