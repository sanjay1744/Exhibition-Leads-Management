using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using ExhibitionLeads.Core.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ExhibitionLeads.Api.Services;

public class SupabaseCloudService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<SupabaseCloudService> _logger;
    private readonly string? _supabaseUrl;
    private readonly string? _supabaseKey;

    public SupabaseCloudService(HttpClient httpClient, IConfiguration config, ILogger<SupabaseCloudService> logger)
    {
        _httpClient = httpClient;
        _config = config;
        _supabaseUrl = (_config["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL") ?? "https://rxsnrpkkejoqwujoireu.supabase.co").TrimEnd('/');
        _supabaseKey = _config["Supabase:SecretKey"] 
            ?? _config["Supabase:PublishableKey"] 
            ?? Environment.GetEnvironmentVariable("SUPABASE_SECRET_KEY") 
            ?? Environment.GetEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY");
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_supabaseUrl) && !string.IsNullOrWhiteSpace(_supabaseKey);

    private HttpRequestMessage CreateRequest(HttpMethod method, string path, object? body = null)
    {
        var request = new HttpRequestMessage(method, $"{_supabaseUrl}/rest/v1/{path}");
        request.Headers.Add("apikey", _supabaseKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _supabaseKey);
        request.Headers.Add("Prefer", "resolution=merge-duplicates");
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }
        return request;
    }

    public async Task<bool> SyncLeadAsync(Lead lead)
    {
        if (!IsConfigured) return false;
        try
        {
            var record = new
            {
                id = lead.Id.ToString(),
                lead_number = lead.LeadNumber,
                exhibition_id = lead.ExhibitionId.ToString(),
                rep_id = lead.RepId.ToString(),
                name = lead.Name,
                company = lead.Company,
                designation = lead.Designation,
                phone = lead.Phone,
                email = lead.Email,
                website = lead.Website,
                address = lead.Address,
                capture_method = lead.CaptureMethod,
                card_image_url = lead.PhotoUrl,
                voice_audio_url = lead.VoiceUrl,
                interest_level = lead.InterestLevel,
                priority = lead.Priority,
                budget = lead.Budget,
                purchase_timeline = lead.PurchaseTimeline,
                follow_up_date = lead.FollowUpDate?.ToString("o"),
                remarks = lead.Remarks,
                voice_notes_transcript = lead.VoiceNotesTranscript,
                sync_status = "Synced"
            };

            using var req = CreateRequest(HttpMethod.Post, "leads", record);
            var response = await _httpClient.SendAsync(req);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[SupabaseCloudService] Error syncing lead to Supabase.");
            return false;
        }
    }
}
