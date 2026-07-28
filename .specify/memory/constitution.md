# Exhibition Lead Capture Platform Constitution

## Core Principles

### I. Offline-First Architecture (NON-NEGOTIABLE)
- Every user-facing feature (OCR scanning, QR scanning, voice recording, lead editing, vCard exchange) MUST function 100% without internet connectivity.
- Local storage (IndexedDB / Dexie.js) is the primary data source. Network operations are asynchronously executed strictly via background sync.

### II. Zero Data Loss Guarantee
- Lead records, audio blobs, and business card images MUST be successfully written and committed to local IndexedDB before the user interface signals completion.
- Network reconnection triggers automatic, retryable background uploads with exponential backoff.

### III. Modularity & Clean Technology Stack
- **Frontend Framework**: **Angular 21** (Standalone Components, Signals for Reactive State, Control Flow `@if`/`@for`/`@switch`, Service Worker PWA).
- **Local Database**: Dexie.js IndexedDB repository services.
- **Client Processing Layer**: Web Workers / Wasm (Tesseract.js for OCR, MediaRecorder for audio, html5-qrcode for QR decoding).
- **Backend Framework**: **.NET 9 / .NET 10 Web API** (C# ASP.NET Core, Entity Framework Core, PostgreSQL / SQL Server database).
- **Sync & Adapter Layer**: ASP.NET Core Sync Gateway & CRM Adapters (Salesforce, HubSpot, Webhooks).

### IV. Structured Data & Validation
- Leads MUST adhere strictly to the `LocalLead` TypeScript interfaces on Angular 21 and mapped C# Data Transfer Objects (DTOs) on .NET Web API.
- Mandatory fields (Name, Company, Phone) are validated on-device before persistence.

### V. Performance Standards
- On-Device OCR processing: < 5 seconds.
- QR Code Scanning: < 2 seconds.
- Lead Record Creation / Save UI Response: < 3 seconds.
- Dashboard Rendering: < 2 seconds.

## Security & Compliance
- Local data (IndexedDB) and auth tokens must be encrypted.
- Communication with .NET Web API MUST use HTTPS with JWT Bearer authentication.

## Governance
- This constitution supersedes default scaffolding. All code modifications, specs, and tasks must align with Angular 21 and .NET Web API offline-first principles.

**Version**: 1.1.0 | **Ratified**: 2026-07-28 | **Last Amended**: 2026-07-28
