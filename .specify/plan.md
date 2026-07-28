# Implementation Plan: Offline-First Exhibition Lead Capture Platform

**Branch**: `main-plan` | **Date**: 2026-07-28 | **Spec**: [.specify/specs/spec.md](file:///d:/AriyAI/exhibition%20leads%20management/.specify/specs/spec.md)

**Input**: Feature specification from `.specify/specs/spec.md`

---

## Summary

The **Exhibition Lead Capture & Digital Business Exchange Platform** is an offline-first solution designed for sales teams operating in network-constrained exhibition environments. 

The system uses an **Angular 21 PWA** on the client side powered by **Dexie.js (IndexedDB)**, client-side WebAssembly OCR (**Tesseract.js**), offline QR code scanning (**html5-qrcode**), and browser audio recording (**MediaRecorder API**). When internet access is detected, an automatic background sync engine uploads pending batch records to an **ASP.NET Core .NET 9/10 Web API** backend connected to **PostgreSQL** and enterprise CRM webhooks.

---

## Technical Context

- **Frontend Language/Version**: TypeScript 5.7+ / **Angular 21** (Standalone Components, Signals, Control Flow `@if`/`@for`).
- **Backend Language/Version**: C# 13 / **.NET 9 / .NET 10 ASP.NET Core Web API**.
- **Primary Dependencies**:
  - *Frontend*: `@angular/pwa`, `@angular/service-worker`, `dexie` (v4), `tesseract.js`, `html5-qrcode`, `ngx-qrcode` / `qrcode`.
  - *Backend*: `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `FluentValidation`, `Serilog`.
- **Storage**:
  - *Client*: Browser **IndexedDB** wrapped with **Dexie.js** (Encrypted table blobs).
  - *Server*: **PostgreSQL 16+** with Entity Framework Core 9/10.
- **Testing**:
  - *Frontend*: Jasmine / Karma & Playwright E2E.
  - *Backend*: xUnit, Moq, Microsoft.AspNetCore.Mvc.Testing.
- **Target Platform**:
  - *Client*: Mobile Web / PWA (Chrome, Safari iOS 16+, Edge, Android/iOS PWA).
  - *Server*: Docker containerized Linux / Azure App Service / IIS.
- **Performance Goals**:
  - On-device OCR extraction: < 5s.
  - On-device QR scan: < 2s.
  - Local IndexedDB write response: < 3s.
  - Backend batch sync (100 leads): < 2s.
- **Constraints**: 100% offline functionality for lead capture, vCard generation, and dashboard viewing. Zero data loss guarantee.

---

## Constitution Check

| Principle | Gate Status | Verification Strategy |
| :--- | :---: | :--- |
| **I. Offline-First Architecture** | **PASS** | Every feature (OCR, QR, Voice, Form) executes against Dexie.js local database without making HTTP calls. |
| **II. Zero Data Loss Guarantee** | **PASS** | Lead records and blobs committed to IndexedDB before UI completion. Background sync handles retries. |
| **III. Angular 21 + .NET 9/10 Stack** | **PASS** | Angular 21 standalone Signal architecture on frontend; ASP.NET Core Web API on backend. |
| **IV. Structured Data & Validation** | **PASS** | Type-safe `LocalLead` interfaces on Angular 21 matching C# DTOs on .NET Web API. |
| **V. Performance Limits** | **PASS** | Performance budgets enforced: OCR < 5s, QR < 2s, Local Save < 3s. |

---

## Project Structure

```text
exhibition-leads-platform/
├── client/                                    # Angular 21 PWA Project
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                          # Core singleton services & models
│   │   │   │   ├── models/
│   │   │   │   │   ├── lead.model.ts          # LocalLead interface & Enums
│   │   │   │   │   └── sync.model.ts          # SyncBatchPayload interface
│   │   │   │   ├── services/
│   │   │   │   │   ├── db.service.ts          # Dexie.js IndexedDB repository
│   │   │   │   │   ├── network.service.ts     # Network status listener (Signal)
│   │   │   │   │   ├── sync.service.ts        # PWA background sync worker
│   │   │   │   │   └── auth.service.ts        # Offline JWT session manager
│   │   │   ├── features/                      # Feature modules (Standalone)
│   │   │   │   ├── lead-capture/              # Capture components (OCR, QR, Voice, Form)
│   │   │   │   │   ├── ocr-scanner.component.ts
│   │   │   │   │   ├── qr-scanner.component.ts
│   │   │   │   │   ├── voice-recorder.component.ts
│   │   │   │   │   └── lead-form.component.ts
│   │   │   │   ├── digital-exchange/          # Offline vCard & Brochure sharing
│   │   │   │   │   ├── vcard-qr.component.ts
│   │   │   │   │   └── brochure-viewer.component.ts
│   │   │   │   └── dashboard/                 # Analytics views
│   │   │   │       ├── sales-dashboard.component.ts
│   │   │   │       └── manager-dashboard.component.ts
│   │   │   ├── app.component.ts
│   │   │   ├── app.config.ts                  # Angular 21 providers & PWA setup
│   │   │   └── app.routes.ts                  # Lazy-loaded routes
│   └── package.json
│
├── server/                                    # .NET 9/10 Web API Solution
│   ├── src/
│   │   ├── ExhibitionLeads.Api/              # ASP.NET Core API Web Host
│   │   │   ├── Controllers/
│   │   │   │   ├── LeadsSyncController.cs     # POST /api/v1/leads/sync
│   │   │   │   ├── AuthController.cs          # JWT Authentication
│   │   │   │   └── AnalyticsController.cs     # Dashboard endpoints
│   │   │   ├── Program.cs
│   │   │   └── appsettings.json
│   │   ├── ExhibitionLeads.Core/             # Domain Models & Interfaces
│   │   │   ├── Entities/
│   │   │   │   ├── Lead.cs
│   │   │   │   ├── MediaAttachment.cs
│   │   │   │   └── User.cs
│   │   │   └── Services/
│   │   │       ├── ISyncService.cs
│   │   │       └── ICrmExporterService.cs
│   │   └── ExhibitionLeads.Infrastructure/   # Data Access & External Integrations
│   │       ├── Data/
│   │       │   └── AppDbContext.cs            # EF Core PostgreSQL DbContext
│   │       └── Services/
│   │           ├── SyncService.cs             # Deduplication & Batch Upsert
│   │           └── CrmExporterService.cs      # Salesforce/HubSpot Webhooks
│   └── ExhibitionLeads.sln
│
└── .specify/                                  # Spec Kit Governance & Specs
    ├── memory/constitution.md
    ├── plan.md
    └── specs/
        └── spec.md
```

**Structure Decision**: Selected standard decoupled Web Application structure (`client/` for Angular 21 PWA and `server/` for .NET Web API Solution), ensuring independent offline client execution and scalable backend containerization.

---

## Data Contracts & API Interfaces

### 1. Angular 21 TypeScript Model (`client/src/app/core/models/lead.model.ts`)

```typescript
export interface LocalLead {
  id: string; // UUID v4
  exhibitionId: string;
  repId: string;
  name: string;
  company: string;
  designation?: string;
  phone: string;
  email?: string;
  website?: string;
  address?: string;
  
  captureMethod: 'card_ocr' | 'qr_scan' | 'manual' | 'voice_note';
  businessCardPhotoBlob?: Blob;
  voiceRecordingBlob?: Blob;
  voiceNotesTranscript?: string;

  interestLevel: 'Hot' | 'Warm' | 'Cold';
  productCategory: string[];
  priority: 'High' | 'Medium' | 'Low';
  budget?: number;
  purchaseTimeline?: string;
  followUpDate?: string;
  remarks?: string;

  syncStatus: 'Pending' | 'Synced' | 'Failed';
  syncError?: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

### 2. .NET Web API DTO (`server/src/ExhibitionLeads.Core/DTOs/SyncDto.cs`)

```csharp
namespace ExhibitionLeads.Core.DTOs;

public record SyncLeadItemDto(
    Guid Id,
    Guid ExhibitionId,
    Guid RepId,
    string Name,
    string Company,
    string? Designation,
    string Phone,
    string? Email,
    string? Website,
    string? Address,
    string CaptureMethod,
    string? PhotoBase64,
    string? VoiceBase64,
    string InterestLevel,
    string[] ProductCategory,
    string Priority,
    decimal? Budget,
    string? PurchaseTimeline,
    DateTimeOffset? FollowUpDate,
    string? Remarks,
    DateTimeOffset CreatedAt
);

public record BatchSyncResponseDto(
    bool Success,
    int SyncedCount,
    List<Guid> SyncedLeadIds,
    List<string> Errors
);
```

---

## Verification Plan

### Automated Testing
- **Client (Angular 21)**: Jasmine unit tests verifying Dexie IndexedDB save operations, Signal reactivity, and vCard QR decoding.
- **Server (.NET Web API)**: xUnit integration tests targeting `LeadsSyncController` using `WebApplicationFactory` and PostgreSQL Testcontainers.

### Manual & Offline Verification Scenarios
1. **PWA Disconnection Test**: Turn off network adapter; capture lead via card OCR, record 30s voice clip, and save. Verify data appears instantly in Dexie IndexedDB.
2. **Reconnection & Sync Test**: Re-enable network adapter; observe Angular Service Worker triggering batch upload to `POST /api/v1/leads/sync`, verifying DB insertion in PostgreSQL.
3. **vCard Scan Verification**: Scan generated on-screen QR code using an iPhone & Android device to verify contact auto-fill.
