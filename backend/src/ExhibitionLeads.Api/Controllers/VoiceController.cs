using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
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

public class VoiceTranscribeRequest
{
    public string AudioDataUrl { get; set; } = string.Empty;
}

public class VoiceTranscribeResult
{
    [JsonPropertyName("transcript")]
    public string Transcript { get; set; } = string.Empty;

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

    [JsonPropertyName("interestLevel")]
    public string? InterestLevel { get; set; }

    [JsonPropertyName("priority")]
    public string? Priority { get; set; }

    [JsonPropertyName("budget")]
    public decimal? Budget { get; set; }

    [JsonPropertyName("purchaseTimeline")]
    public string? PurchaseTimeline { get; set; }

    [JsonPropertyName("productCategory")]
    public List<string>? ProductCategory { get; set; }

    [JsonPropertyName("remarks")]
    public string? Remarks { get; set; }
}

[ApiController]
[Route("api/v1/voice")]
[Route("api/voice")]
public class VoiceController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<VoiceController> _logger;

    public VoiceController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<VoiceController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Gets an OAuth2 access token using Google Cloud service account credentials from appsettings.json.
    /// </summary>
    private async Task<string> GetAccessTokenAsync()
    {
        var clientEmail = _configuration["Gemini:ClientEmail"];
        var privateKey = _configuration["Gemini:PrivateKey"];
        var tokenUri = _configuration["Gemini:TokenUri"] ?? "https://oauth2.googleapis.com/token";

        if (string.IsNullOrWhiteSpace(clientEmail) || string.IsNullOrWhiteSpace(privateKey))
        {
            throw new InvalidOperationException("Service account credentials (ClientEmail, PrivateKey) are not configured.");
        }

        var credential = new ServiceAccountCredential(
            new ServiceAccountCredential.Initializer(clientEmail, tokenUri)
            {
                Scopes = new[] { "https://www.googleapis.com/auth/cloud-platform" }
            }.FromPrivateKey(privateKey));

        return await credential.GetAccessTokenForRequestAsync();
    }

    [HttpPost("transcribe")]
    public async Task<IActionResult> TranscribeAndExtractLead([FromBody] VoiceTranscribeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.AudioDataUrl))
        {
            return BadRequest(new { Message = "AudioDataUrl is required" });
        }

        var model = (_configuration["Gemini:Model"] ?? "gemini-2.5-flash")?.Trim();
        var projectId = (_configuration["Gemini:ProjectId"] ?? "exhibition-leads-508711")?.Trim();
        var region = (_configuration["Gemini:Region"] ?? "us-central1")?.Trim();

        try
        {
            string accessToken;
            try
            {
                accessToken = await GetAccessTokenAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to obtain OAuth2 access token for Gemini Voice transcription.");
                return StatusCode(503, new { Message = "Failed to authenticate with Gemini API. Check service account configuration.", Error = ex.Message });
            }

            // 1. Extract base64 and clean MIME type from Data URL
            var match = Regex.Match(request.AudioDataUrl, @"^data:([a-zA-Z0-9\+\-\/]+)(?:;[a-zA-Z0-9\=\-\.]+)*;base64,(.+)$", RegexOptions.Singleline);
            var rawMime = match.Success ? match.Groups[1].Value.ToLowerInvariant() : "audio/webm";
            var base64Data = match.Success ? match.Groups[2].Value.Trim() : request.AudioDataUrl.Trim();

            // Normalize MIME type for Vertex AI (e.g. audio/webm, audio/mp4, audio/ogg, audio/wav)
            string mimeType = "audio/webm";
            if (rawMime.Contains("mp4") || rawMime.Contains("m4a") || rawMime.Contains("aac"))
            {
                mimeType = "audio/mp4";
            }
            else if (rawMime.Contains("ogg"))
            {
                mimeType = "audio/ogg";
            }
            else if (rawMime.Contains("wav"))
            {
                mimeType = "audio/wav";
            }
            else if (rawMime.Contains("mp3") || rawMime.Contains("mpeg"))
            {
                mimeType = "audio/mp3";
            }

            // 2. Build Gemini Multimodal Voice Prompt
            const string prompt = """
                You are an AI sales assistant analyzing an audio voice note recorded by a sales representative or visitor at an exhibition stall/booth.
                Your job is to:
                1. Transcribe the audio verbatim and accurately. If spoken in a mixture of languages (e.g. Indian English / Hindi / regional terms), transcribe cleanly in English or maintain original names and technical terms.
                2. Extract and structure all relevant lead details mentioned in the recording into clean fields.

                Return ONLY a valid JSON object matching this exact schema:
                {
                  "transcript": "Verbatim transcript of the voice note",
                  "name": "Full name of the contact person or visitor (or null if not mentioned)",
                  "designation": "Job title/role (or null)",
                  "company": "Company or organization name (or null)",
                  "phone": "Phone or mobile number formatted cleanly (or null)",
                  "email": "Email address (or null)",
                  "website": "Website URL (or null)",
                  "address": "City, state or office address (or null)",
                  "interestLevel": "Hot" | "Warm" | "Cold" (or null, infer based on urgency and purchase intent),
                  "priority": "High" | "Medium" | "Low" (or null),
                  "budget": numeric budget amount (or null),
                  "purchaseTimeline": "Immediate" | "1-3 Months" | "3-6 Months" | "Next Year" (or null),
                  "productCategory": ["Category 1", "Category 2"] (or null),
                  "remarks": "Concise summary of key discussion points, requirements, and next steps"
                }

                Rules:
                - Output strictly valid JSON. Do not include markdown code block backticks (```json).
                - Standardize phone numbers if spoken as digits.
                - If any lead field is missing from the audio, set its value to null.
                """;

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
            client.Timeout = TimeSpan.FromSeconds(45);

            var endpointUrl = $"https://{region}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{region}/publishers/google/models/{model}:generateContent";
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpointUrl)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };

            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            _logger.LogInformation("Calling Vertex AI Gemini with model {Model} for Voice Transcription ({MimeType})", model, mimeType);
            var response = await client.SendAsync(httpRequest);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("Gemini Voice API returned status {StatusCode}: {Error}", response.StatusCode, errorBody);
                return StatusCode((int)response.StatusCode, new
                {
                    Message = "Gemini Voice API request failed",
                    StatusCode = (int)response.StatusCode,
                    Details = errorBody
                });
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseJson);

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

            rawOutput = Regex.Replace(rawOutput, @"^```(json)?\s*", "", RegexOptions.Multiline);
            rawOutput = Regex.Replace(rawOutput, @"\s*```$", "", RegexOptions.Multiline).Trim();

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var parsedResult = JsonSerializer.Deserialize<VoiceTranscribeResult>(rawOutput, options) ?? new VoiceTranscribeResult();

            _logger.LogInformation("Successfully transcribed voice note using Gemini 2.5 Flash. Transcript length: {Len}, Lead Name: {Name}, Company: {Company}",
                parsedResult.Transcript?.Length ?? 0, parsedResult.Name ?? "None", parsedResult.Company ?? "None");

            return Ok(parsedResult);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while transcribing voice note with Gemini API");
            return StatusCode(500, new { Message = "Internal error calling Gemini Voice Transcription", Error = ex.Message });
        }
    }
}
