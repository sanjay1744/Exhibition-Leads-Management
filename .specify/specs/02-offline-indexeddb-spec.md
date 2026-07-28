# Feature Specification: Local Data Store & Offline Persistence (Dexie.js / IndexedDB)

**Feature Branch**: `02-offline-indexeddb-dexie`
**Created**: 2026-07-28
**Status**: Draft
**Input**: BRD v1.0 Section 7 (Offline Requirements) & Section 8 (Local Data Storage)

---

## User Scenarios & Testing

### User Story 1 - Local Lead Storage (Priority: P1)
As a user, all captured lead data (including photos & voice blobs) must persist locally in browser IndexedDB using Dexie.js so that no data is lost during browser refresh, tab closure, or app restarts.

**Acceptance Scenarios**:
1. **Given** 50 leads captured offline, **When** application is restarted offline, **Then** all 50 leads and audio attachments are loaded instantly from Dexie.js.

---

## Functional Requirements
- **FR-010**: Setup Dexie.js database versioning schema with tables: `leads`, `events`, `brochures`, `syncQueue`, `userSession`.
- **FR-011**: Offline leads table schema:
  - `id`: string (UUID v4)
  - `name`, `company`, `phone`, `email`, `website`, `designation`
  - `captureMethod`: `'card_ocr' | 'qr_scan' | 'manual' | 'voice_note'`
  - `photoBlob`: Blob / DataUrl
  - `voiceBlob`: Blob
  - `interestLevel`: `'Hot' | 'Warm' | 'Cold'`
  - `priority`, `budget`, `followUpDate`, `remarks`
  - `syncStatus`: `'Pending' | 'Synced' | 'Failed'`
  - `createdAt`, `updatedAt`
- **FR-012**: Angular 21 Dexie DB service wrapper exposes Signal-based reactive live queries (`toSignal(liveQuery(() => db.leads.toArray()))`).
