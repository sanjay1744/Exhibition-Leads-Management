using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using ExhibitionLeads.Core.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ExhibitionLeads.Api.Services;

public class FirebaseCloudService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<FirebaseCloudService> _logger;
    private readonly string? _databaseUrl;

    public FirebaseCloudService(HttpClient httpClient, IConfiguration config, ILogger<FirebaseCloudService> logger)
    {
        _httpClient = httpClient;
        _config = config;
        _logger = logger;
        _databaseUrl = _config["Firebase:DatabaseUrl"]?.TrimEnd('/');
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_databaseUrl);

    /// <summary>
    /// Synchronizes a lead document into Firebase cloud database
    /// </summary>
    public async Task<bool> SyncLeadAsync(Lead lead)
    {
        if (!IsConfigured) return false;

        try
        {
            var endpoint = $"{_databaseUrl}/leads/{lead.Id}.json";
            var payload = new
            {
                id = lead.Id,
                leadNumber = lead.LeadNumber,
                exhibitionId = lead.ExhibitionId,
                stallId = lead.StallId,
                repId = lead.RepId,
                name = lead.Name,
                company = lead.Company,
                designation = lead.Designation,
                phone = lead.Phone,
                email = lead.Email,
                website = lead.Website,
                address = lead.Address,
                captureMethod = lead.CaptureMethod,
                photoUrl = lead.PhotoUrl,
                interestLevel = lead.InterestLevel,
                productCategory = lead.ProductCategory,
                priority = lead.Priority,
                budget = lead.Budget,
                purchaseTimeline = lead.PurchaseTimeline,
                followUpDate = lead.FollowUpDate?.ToString("o"),
                remarks = lead.Remarks,
                status = lead.Status,
                syncStatus = "Synced",
                createdAt = lead.CreatedAt.ToString("o"),
                updatedAt = lead.UpdatedAt.ToString("o"),
                cloudSyncedAt = DateTimeOffset.UtcNow.ToString("o")
            };

            var response = await _httpClient.PutAsJsonAsync(endpoint, payload);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("[FirebaseCloudService] Lead {LeadNumber} successfully mirrored to Firebase.", lead.LeadNumber);
                return true;
            }
            else
            {
                _logger.LogWarning("[FirebaseCloudService] Firebase mirror returned status {StatusCode}.", response.StatusCode);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FirebaseCloudService] Failed to mirror lead {LeadNumber} to Firebase.", lead.LeadNumber);
            return false;
        }
    }

    /// <summary>
    /// Synchronizes an exhibition document into Firebase cloud database
    /// </summary>
    public async Task<bool> SyncExhibitionAsync(Exhibition exhibition)
    {
        if (!IsConfigured) return false;

        try
        {
            var endpoint = $"{_databaseUrl}/exhibitions/{exhibition.Id}.json";
            var response = await _httpClient.PutAsJsonAsync(endpoint, exhibition);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[FirebaseCloudService] Failed to mirror exhibition to Firebase.");
            return false;
        }
    }

    /// <summary>
    /// Synchronizes a stall document into Firebase cloud database
    /// </summary>
    public async Task<bool> SyncStallAsync(Stall stall)
    {
        if (!IsConfigured) return false;

        try
        {
            var endpoint = $"{_databaseUrl}/stalls/{stall.Id}.json";
            var response = await _httpClient.PutAsJsonAsync(endpoint, stall);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[FirebaseCloudService] Failed to mirror stall to Firebase.");
            return false;
        }
    }
}
