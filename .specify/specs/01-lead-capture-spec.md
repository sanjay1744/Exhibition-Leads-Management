# Feature Specification: Offline Lead Capture Engine (Angular 21)

**Feature Branch**: `01-lead-capture-angular21`
**Created**: 2026-07-28
**Status**: Draft
**Input**: BRD v1.0 Section 6.2 (Lead Capture Methods) & Section 7 (Offline Requirements)

---

## User Scenarios & Testing

### User Story 1 - Business Card OCR Capture (Priority: P1)
As an exhibition sales representative, I want to scan visitor business cards using my mobile/tablet camera offline so that contact details are extracted into editable form fields in under 5 seconds without internet connectivity.

**Why this priority**: Business cards are the primary medium of exchange at expos. Speed and accuracy without network latency are critical.

**Independent Test**: Disconnect network, upload/capture a card photo, verify Tesseract.js extracts Name, Company, Designation, Phone, Email, and populates the Angular 21 reactive form.

**Acceptance Scenarios**:
1. **Given** device is offline, **When** user taps "Scan Card" and captures card image, **Then** OCR extracts text and populates form fields within 5 seconds.
2. **Given** OCR misinterprets text, **When** user reviews extracted fields, **Then** user can manually correct any field before saving to local IndexedDB.

---

### User Story 2 - vCard / QR Code Instant Lead Capture (Priority: P1)
As a sales representative, I want to scan visitor vCard or LinkedIn QR codes offline using `html5-qrcode` so that lead details are parsed instantly (<2 seconds).

**Why this priority**: QR code scanning is the fastest lead capture method when visitors present digital cards.

**Independent Test**: Scan a test vCard QR code while offline and verify parsing into Angular 21 Signal state.

**Acceptance Scenarios**:
1. **Given** visitor displays vCard QR code, **When** representative scans QR code via camera, **Then** details parse into lead form in < 2 seconds.

---

### User Story 3 - Voice Note Capture & Local Audio Storage (Priority: P2)
As a sales representative, I want to record voice notes after discussing with a visitor so that key conversation highlights are saved as audio blobs locally in IndexedDB.

**Why this priority**: Reps forget discussion points between visitors. Voice notes provide quick context capture.

**Independent Test**: Record 30 seconds of audio offline, save lead, reload app offline, and play back stored audio blob.

---

### User Story 4 - Manual Form Entry & Qualification (Priority: P1)
As a sales representative, I want to enter lead details manually and assign lead qualification status (Hot/Warm/Cold, Priority, Budget, Product Interests) using modern Angular 21 control flow forms.

---

## Technical Requirements (Angular 21 PWA)

### Functional Requirements
- **FR-001**: Angular 21 standalone components using Signals (`signal()`, `computed()`, `effect()`) for state management.
- **FR-002**: Modern Angular Control Flow (`@if`, `@for`, `@switch`) replacing structural directives.
- **FR-003**: Integration of Tesseract.js Wasm for on-device card OCR.
- **FR-004**: Integration of `html5-qrcode` for offline vCard and URL QR scanning.
- **FR-005**: Integration of Browser `MediaRecorder` API for voice recording audio blob capture.
- **FR-006**: Instant local save to Dexie.js IndexedDB with unique UUID v4.

---

## Measurable Success Criteria
- **SC-001**: OCR extraction completed in < 5 seconds on-device.
- **SC-002**: QR code parsed in < 2 seconds.
- **SC-003**: 100% functionality maintained offline.
