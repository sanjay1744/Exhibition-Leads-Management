using System;
using System.Linq;
using System.Threading.Tasks;
using ExhibitionLeads.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExhibitionLeads.Api.Controllers;

[ApiController]
[Route("api/v1/analytics")]
public class AnalyticsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public AnalyticsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var total = await _dbContext.Leads.CountAsync();
        var hot = await _dbContext.Leads.CountAsync(l => l.InterestLevel == "Hot");
        var warm = await _dbContext.Leads.CountAsync(l => l.InterestLevel == "Warm");
        var cold = await _dbContext.Leads.CountAsync(l => l.InterestLevel == "Cold");

        var byMethod = await _dbContext.Leads
            .GroupBy(l => l.CaptureMethod)
            .Select(g => new { Method = g.Key, Count = g.Count() })
            .ToListAsync();

        return Ok(new
        {
            TotalLeads = total,
            HotLeads = hot,
            WarmLeads = warm,
            ColdLeads = cold,
            CaptureMethods = byMethod
        });
    }
}
