# Feature Specification: Offline-First Exhibition Lead Capture Platform

**Feature Branch**: `main-spec`  
**Created**: 2026-07-28  
**Status**: Approved  
**Input**: BRD Document (`Offline-First Exhibition Lead Capture Platform.md`)  
**Target Stack**: Angular 21 (PWA + Dexie IndexedDB) & .NET 9/10 Web API (EF Core + PostgreSQL)

---

## User Scenarios & Testing

### User Story 1 - Offline Lead Capture via OCR, QR, Form & Voice (Priority: P1)
As an exhibition sales representative, I want to capture visitor lead details offline using business card OCR scanning, vCard QR scanner, voice note audio recorder, or manual form entry so that I can collect leads in high-density expo halls with zero internet connectivity.

**Why this priority**: Core value proposition of the product. Eliminates paper cards and manual spreadsheet loss during trade shows.

**Independent Test**: Put browser into offline mode (Flight mode / Network disabled). Scan a business card image, record a 30s voice clip, complete lead qualification form, and verify instant save to Dexie IndexedDB in <3s with zero network requests.

**Acceptance Scenarios**:
1. **Given** no internet connection, **When** representative captures a card image, **Then** Tesseract.js Wasm extracts contact info in <5 seconds and populates the Angular 21 form.
2. **Given** visitor presents vCard QR code, **When** representative scans with camera, **Then** `html5-qrcode` decodes contact info in <2 seconds.
3. **Given** rep records a voice note, **When** rep saves lead, **Then** audio blob is stored locally in IndexedDB linked to the Lead ID (UUID v4).

---

### User Story 2 - Pre-Exhibition Login & Offline Session Resume (Priority: P1)
As a sales representative, I want to log in before going to the exhibition hall and download relevant event product catalogs so that my session remains active offline for up to 7 days without requiring internet re-authentication.

**Acceptance Scenarios**:
1. **Given** valid online authentication, **When** rep logs in before event, **Then** JWT tokens, user profile, and event product catalogs are cached in IndexedDB.
2. **Given** device loses internet, **When** rep reopens the app offline, **Then** session resumes seamlessly using cached encrypted tokens.

---

### User Story 3 - Digital Business Exchange & Offline vCard Sharing (Priority: P2)
As a sales representative, I want to display my digital business card as an offline vCard 3.0 QR code and present company PDF brochures directly from my tablet so that visitors can quickly capture my contact details.

**Acceptance Scenarios**:
1. **Given** device is offline, **When** rep taps "Share vCard", **Then** app renders QR code encoding standard vCard 3.0 string.
2. **Given** visitor scans QR with native phone camera, **Then** visitor phone prompts "Add to Contacts".

---

### User Story 4 - Background Auto-Sync & .NET Duplicate Resolution (Priority: P1)
As a system administrator, when network connectivity is restored, pending offline leads must automatically upload to the .NET 9/10 Web API, save binary media to cloud storage, and deduplicate records before pushing to CRM.

**Acceptance Scenarios**:
1. **Given** 30 pending offline leads in Dexie IndexedDB, **When** Angular 21 network listener detects online status, **Then** `SyncService` posts batch payload to `POST /api/v1/leads/sync`.
2. **Given** duplicate email/phone exists, **When** .NET Web API processes batch, **Then** API merges duplicate fields, saves media attachments, and returns synced IDs.
3. **Given** upload succeeds, **Then** local leads status changes from `Pending` to `Synced`.

---

### User Story 5 - Real-Time Sales & Executive Dashboards (Priority: P2)
As a sales rep or event manager, I want to view real-time lead analytics (Total Leads, Hot/Warm/Cold counts, Scanned Cards, Sync Status) both offline and online.

---

## Edge Cases

- **Storage Full**: How does system handle browser IndexedDB quota limits? *(Alerts user to perform sync or clear uploaded media caches when quota exceeds 80%)*.
- **Mid-Upload Disconnection**: What happens if network drops during a batch sync POST request? *(Transaction rolls back safely; local sync status remains `Pending` and retries automatically with exponential backoff)*.
- **Corrupted Image / Audio**: How does system handle unreadable business cards or corrupted audio? *(Allows manual form bypass and highlights unparsed fields with validation indicators)*.

---

## Functional Requirements

### Angular 21 Frontend PWA Requirements
- **FR-001**: Angular 21 standalone architecture with Signals (`signal()`, `computed()`) for reactive UI updates.
- **FR-002**: Modern Angular Control Flow (`@if`, `@for`, `@switch`) across all template components.
- **FR-003**: Service Worker PWA manifest allowing full offline app shell installation.
- **FR-004**: Dexie.js IndexedDB local repository for `leads`, `media`, `events`, `userSession`, and `syncQueue`.
- **FR-005**: Tesseract.js client-side OCR Wasm engine for business card parsing.
- **FR-006**: `html5-qrcode` scanner for vCard / URL decoding.
- **FR-007**: Browser `MediaRecorder` API for voice recording audio blob capture.
- **FR-008**: Reactive qualification form supporting fields: Name, Company, Designation, Mobile (mandatory), Email, Website, Address, Interest Level (Hot/Warm/Cold), Priority (High/Med/Low), Budget, Purchase Timeline, Follow-up Date, Remarks.

### .NET Web API & Data Engine Requirements
- **FR-010**: Built with **.NET 9 / .NET 10 ASP.NET Core Web API (C#)**.
- **FR-011**: **Entity Framework Core 9/10** with **PostgreSQL** database provider.
- **FR-012**: Controller endpoint `POST /api/v1/leads/sync` supporting transactional batch processing and multipart file uploads.
- **FR-013**: Phone number (E.164) and email normalization service for duplicate lead merging.
- **FR-014**: JWT Bearer Authentication with Role-Based Access Control (SalesRep, Manager, Admin).
- **FR-015**: Asynchronous background webhook exporter (`IHostedService` / Hangfire) for CRM integration (Salesforce, HubSpot, Zoho).

---

## Success Criteria

- **SC-001**: 100% of lead capture & editing functions operate offline without network calls.
- **SC-002**: Business card OCR extraction time < 5 seconds on-device.
- **SC-003**: QR Code decoding time < 2 seconds.
- **SC-004**: Save operation response time < 3 seconds into Dexie IndexedDB.
- **SC-005**: .NET batch synchronization processes 100 leads in < 2 seconds.
- **SC-006**: Zero data loss across browser restarts or unexpected disconnects.
