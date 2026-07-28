# Tasks: Exhibition Lead Capture & Digital Business Exchange Platform

**Input**: Design documents from `.specify/plan.md` and `.specify/specs/spec.md`  
**Prerequisites**: `plan.md` (complete), `spec.md` (complete), `constitution.md` (ratified)  
**Stack**: Angular 21 (Client PWA) + .NET 9/10 Web API (Backend Server)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Initialize workspace folder structure for `client/` (Angular 21) and `server/` (.NET Web API solution)
- [x] T002 Initialize Angular 21 Standalone PWA project in `client/` with Service Worker enabled
- [x] T003 [P] Initialize .NET 9/10 ASP.NET Core Web API solution in `server/`
- [x] T004 [P] Configure Angular 21 `package.json` environment settings

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T005 [P] Create Angular 21 Lead interfaces & enums in `client/src/app/core/models/lead.model.ts`
- [x] T006 [P] Implement Dexie.js IndexedDB repository service in `client/src/app/core/services/db.service.ts`
- [x] T007 [P] Create Entity Framework Core 9/10 DbContext & Entity models in `server/src/ExhibitionLeads.Infrastructure/Data/AppDbContext.cs`
- [x] T008 Implement Network status Signal service (`online` / `offline`) in `client/src/app/core/services/network.service.ts`

---

## Phase 3: User Story 1 - Offline Multi-Method Lead Capture (Priority: P1) 🎯 MVP

- [x] T009 [P] [US1] Create Business Card OCR component with `Tesseract.js` in `client/src/app/features/lead-capture/ocr-scanner.component.ts`
- [x] T010 [P] [US1] Create vCard & QR scanner component with `html5-qrcode` in `client/src/app/features/lead-capture/qr-scanner.component.ts`
- [x] T011 [P] [US1] Create Voice Recorder component with `MediaRecorder` in `client/src/app/features/lead-capture/voice-recorder.component.ts`
- [x] T012 [US1] Create Angular 21 Reactive Qualification Form using Signals & `@if`/`@for` control flow in `client/src/app/features/lead-capture/lead-form.component.ts`
- [x] T013 [US1] Wire form submit action to store lead and binary attachments (photo & audio blobs) into Dexie IndexedDB

---

## Phase 4: User Story 2 - Pre-Exhibition Login & Offline Session (Priority: P1)

- [x] T014 [P] [US2] Build ASP.NET Core JWT Auth Controller in `server/src/ExhibitionLeads.Api/Controllers/AuthController.cs`
- [x] T015 [US2] Build Angular 21 Auth Service with IndexedDB token caching in `client/src/app/core/services/auth.service.ts`
- [x] T016 [US2] Build Angular Login View Component in `client/src/app/features/auth/login.component.ts`

---

## Phase 5: User Story 3 - Digital Business Exchange & vCard QR (Priority: P2)

- [x] T017 [P] [US3] Build Offline vCard QR Code Generator component in `client/src/app/features/digital-exchange/vcard-qr.component.ts`
- [x] T018 [P] [US3] Build Product Brochure PDF Presenter component in `client/src/app/features/digital-exchange/brochure-viewer.component.ts`

---

## Phase 6: User Story 4 - .NET Auto-Sync & Deduplication Engine (Priority: P1)

- [x] T019 [P] [US4] Create .NET Batch Sync Controller (`POST /api/v1/leads/sync`) in `server/src/ExhibitionLeads.Api/Controllers/LeadsSyncController.cs`
- [x] T020 [US4] Implement .NET Transactional Sync & E.164 Phone/Email Deduplication Service
- [x] T021 [US4] Implement Angular 21 PWA Background Sync Worker in `client/src/app/core/services/sync.service.ts`
- [x] T022 [US4] Wire background sync worker to network status listener to auto-upload pending leads when online

---

## Phase 7: User Story 5 - Real-Time Sales & Executive Dashboards (Priority: P2)

- [x] T023 [P] [US5] Build Sales Representative Dashboard Component in `client/src/app/features/dashboard/sales-dashboard.component.ts`
- [x] T024 [P] [US5] Build Management Executive Analytics View Component in `client/src/app/features/dashboard/manager-dashboard.component.ts`
- [x] T025 [US5] Build .NET Analytics Controller (`GET /api/v1/analytics/summary`) in `server/src/ExhibitionLeads.Api/Controllers/AnalyticsController.cs`

---

## Phase 8: Polish & Verification

- [x] T026 Add Angular 21 App Component & Navigation Routes (`app.component.ts`, `app.routes.ts`)
- [x] T027 Complete end-to-end offline lead capture, Dexie storage, and .NET batch sync architecture verification
