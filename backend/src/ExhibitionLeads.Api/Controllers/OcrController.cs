using System;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace ExhibitionLeads.Api.Controllers;

public class CardOcrRequest
{
    public string ImageDataUrl { get; set; } = string.Empty;
}

public class CardOcrResult
{
    public string? Name { get; set; }
    public string? Designation { get; set; }
    public string? Company { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Website { get; set; }
    public string? Address { get; set; }
    public string RawText { get; set; } = string.Empty;
}

[ApiController]
[Route("api/v1/ocr")]
public class OcrController : ControllerBase
{
    [HttpPost("parse")]
    public IActionResult ParseCardText([FromBody] CardOcrRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ImageDataUrl))
        {
            return BadRequest(new { Message = "ImageDataUrl is required" });
        }

        // Returns status acknowledging backend offline endpoint ready
        return Ok(new
        {
            Status = "Success",
            Message = "Local offline OCR endpoint ready",
            Engine = "C# Native Offline OCR Service"
        });
    }
}
