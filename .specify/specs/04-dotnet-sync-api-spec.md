# Feature Specification: .NET Web API Synchronization Server & Enterprise CRM Gateway

**Feature Branch**: `04-dotnet-sync-api`
**Created**: 2026-07-28
**Status**: Draft
**Input**: BRD v1.0 Section 9 (Synchronization Requirements) & Section 13 (Technology Stack)

---

## User Scenarios & Testing

### User Story 1 - Batch Synchronization Endpoint (Priority: P1)
As an offline PWA client, when network connectivity is restored, I want to submit a batch payload of pending leads (with multipart image/voice attachments) to the .NET Web API sync endpoint so that central PostgreSQL database is updated reliably.

**Acceptance Scenarios**:
1. **Given** 20 pending offline leads in PWA, **When** PWA detects network online status, **Then** PWA posts batch payload to `POST /api/v1/leads/sync`, **And** API processes batch within a single transaction, returning synced status IDs.

### User Story 2 - Duplicate Lead Detection & Conflict Resolution (Priority: P1)
As a sales team manager, when multiple reps capture the same visitor, I want the .NET backend to detect duplicate email/phone records and merge updates intelligently.

---

## Technical Requirements (.NET Web API)

### Functional Requirements
- **FR-020**: Built with **.NET 9 / .NET 10 ASP.NET Core Web API (C#)**.
- **FR-021**: **Entity Framework Core** with **PostgreSQL** (Npgsql) database provider.
- **FR-022**: Endpoint `POST /api/v1/leads/sync`:
  - Accepts `BatchLeadSyncRequestDto` containing array of leads and base64/multipart binary attachments.
  - Implements transactional upsert and duplicate detection by normalized Phone/Email.
  - Saves photos and voice clips to Azure Blob Storage / AWS S3 / Local Disk Repository.
- **FR-023**: JWT Bearer token authentication & Role-Based Access Control (SalesRep, Manager, Admin).
- **FR-024**: Background worker service (`IHostedService` / Hangfire) for asynchronous CRM export (Salesforce / HubSpot REST webhooks).

---

## Success Criteria
- **SC-020**: Batch endpoint processes 100 leads under 2 seconds.
- **SC-021**: Zero duplicate lead duplication in PostgreSQL database.
