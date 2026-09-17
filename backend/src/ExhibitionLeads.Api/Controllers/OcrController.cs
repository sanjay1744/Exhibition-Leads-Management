using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Google.Apis.Auth.OAuth2;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ExhibitionLeads.Api.Controllers;

public class CardOcrRequest
{
    public string ImageDataUrl { get; set; } = string.Empty;
}

public class CardOcrResult
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("designation")]
    public string? Designation { get; set; }

    [JsonPropertyName("company")]
    public string? Company { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("website")]
    public string? Website { get; set; }

    [JsonPropertyName("address")]
    public string? Address { get; set; }

    [JsonPropertyName("rawText")]
    public string RawText { get; set; } = string.Empty;
}

[ApiController]
[Route("api/v1/ocr")]
[Route("api/ocr")]
public class OcrController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OcrController> _logger;

    public OcrController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<OcrController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Gets an OAuth2 access token using service account credentials.
    /// </summary>
    private async Task<string> GetAccessTokenAsync()
    {
        var clientEmail = _configuration["Gemini:ClientEmail"];
        var privateKey = _configuration["Gemini:PrivateKey"];
        var tokenUri = _configuration["Gemini:TokenUri"] ?? "https://oauth2.googleapis.com/token";

        if (string.IsNullOrWhiteSpace(clientEmail) || string.IsNullOrWhiteSpace(privateKey) || privateKey == "PASTE_YOUR_PRIVATE_KEY_HERE")
        {
            throw new InvalidOperationException("Service account credentials (ClientEmail, PrivateKey) are not configured.");
        }

        var credential = new ServiceAccountCredential(
            new ServiceAccountCredential.Initializer(clientEmail, tokenUri)
            {
                Scopes = new[] { "https://www.googleapis.com/auth/cloud-platform" }
            }.FromPrivateKey(privateKey));

        var token = await credential.GetAccessTokenForRequestAsync();
        return token;
    }

    [HttpPost("parse")]
    public async Task<IActionResult> ParseCardText([FromBody] CardOcrRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.ImageDataUrl))
        {
            return BadRequest(new { Message = "ImageDataUrl is required" });
        }

        var model = (_configuration["Gemini:Model"] ?? "gemini-2.5-flash")?.Trim();
        var projectId = (_configuration["Gemini:ProjectId"] ?? "exhibition-leads-508711")?.Trim();
        var region = (_configuration["Gemini:Region"] ?? "us-central1")?.Trim();

        try
        {
            // Get OAuth2 access token from service account
            string accessToken;
            try
            {
                accessToken = await GetAccessTokenAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to obtain OAuth2 access token from service account.");
                return StatusCode(503, new { Message = "Failed to authenticate with Gemini API. Check service account configuration.", Error = ex.Message });
            }

            // 1. Extract base64 and mime type from data URL
            var match = Regex.Match(request.ImageDataUrl, @"^data:(image\/[a-zA-Z0-9\+\-]+);base64,(.+)$", RegexOptions.Singleline);
            var mimeType = match.Success ? match.Groups[1].Value : "image/jpeg";
            var base64Data = match.Success ? match.Groups[2].Value.Trim() : request.ImageDataUrl.Trim();

            // 2. Build Gemini Vision prompt
            const string prompt =
                "Extract all business card information from this image.\n" +
                "Return ONLY a valid JSON object matching this exact schema:\n" +
                "{\n" +
                "  \"name\": \"Full name of the contact person (or null if not found)\",\n" +
                "  \"designation\": \"Job title or role (or null if not found)\",\n" +
                "  \"company\": \"Company or organization name (or null if not found)\",\n" +
                "  \"phone\": \"Phone / mobile number(s) (separate multiple numbers with a comma, or null if not found)\",\n" +
                "  \"email\": \"Email address (or null if not found)\",\n" +
                "  \"website\": \"Website URL (or null if not found)\",\n" +
                "  \"address\": \"Office or postal address (or null if not found)\",\n" +
                "  \"rawText\": \"All visible text from the business card\"\n" +
                "}\n" +
                "Rules:\n" +
                "- Output strictly valid JSON. Do not include markdown ticks (```json).\n" +
                "- Clean up phone numbers to be readable.\n" +
                "- If any field is missing, set its value to null.";

            var payload = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new object[]
                        {
                            new { text = prompt },
                            new
                            {
                                inline_data = new
                                {
                                    mime_type = mimeType,
                                    data = base64Data
                                }
                            }
                        }
                    }
                },
                generationConfig = new
                {
                    responseMimeType = "application/json",
                    temperature = 0.1
                }
            };

            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(30);

            // Use Google Cloud Vertex AI endpoint (charges to GCP project with Free Trial credits)
            var endpointUrl = $"https://{region}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{region}/publishers/google/models/{model}:generateContent";
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpointUrl)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };

            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            _logger.LogInformation("Calling Vertex AI Gemini with model: {Model} in {Region} using service account auth", model, region);
            var response = await client.SendAsync(httpRequest);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("Gemini API returned status {StatusCode}: {Error}", response.StatusCode, errorBody);
                return StatusCode((int)response.StatusCode, new
                {
                    Message = "Gemini API request failed",
                    StatusCode = (int)response.StatusCode,
                    Details = errorBody
                });
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseJson);

            // Navigate to candidates[0].content.parts[0].text
            if (!doc.RootElement.TryGetProperty("candidates", out var candidates) ||
                candidates.GetArrayLength() == 0 ||
                !candidates[0].TryGetProperty("content", out var content) ||
                !content.TryGetProperty("parts", out var parts) ||
                parts.GetArrayLength() == 0 ||
                !parts[0].TryGetProperty("text", out var textElement))
            {
                _logger.LogWarning("Gemini API response did not contain candidates content text.");
                return StatusCode(502, new { Message = "Malformed response structure from Gemini API" });
            }

            var rawOutput = textElement.GetString() ?? "{}";

            // Clean markdown code blocks if present
            rawOutput = Regex.Replace(rawOutput, @"^```(json)?\s*", "", RegexOptions.Multiline);
            rawOutput = Regex.Replace(rawOutput, @"\s*```$", "", RegexOptions.Multiline).Trim();

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var parsedResult = JsonSerializer.Deserialize<CardOcrResult>(rawOutput, options) ?? new CardOcrResult();

            _logger.LogInformation("Successfully parsed business card using Gemini 3.8 Flash for: {Name} at {Company}",
                parsedResult.Name ?? "Unknown", parsedResult.Company ?? "Unknown");

            return Ok(parsedResult);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while parsing card with Gemini API");
            return StatusCode(500, new { Message = "Internal error calling Gemini OCR", Error = ex.Message });
        }
    }
}

