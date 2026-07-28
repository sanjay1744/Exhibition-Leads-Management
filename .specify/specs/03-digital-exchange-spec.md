# Feature Specification: Digital Business Exchange & Offline vCard Sharing

**Feature Branch**: `03-digital-exchange-vcard`
**Created**: 2026-07-28
**Status**: Draft
**Input**: BRD v1.0 Section 6.4 (Company Information Sharing)

---

## User Scenarios & Testing

### User Story 1 - Dynamic vCard QR Code Generation (Priority: P1)
As a sales representative, I want to display a dynamic vCard QR code on my screen offline so that visitors can scan it with their phone camera to instantly save my contact card to their phone contacts.

**Acceptance Scenarios**:
1. **Given** device is offline, **When** representative opens "Share Contact", **Then** application renders vCard 3.0 compatible QR code offline.

### User Story 2 - Offline Product Brochure PDF Delivery (Priority: P2)
As a sales representative, I want to present product catalog PDFs stored in local IndexedDB so visitors can view or download them via offline local Wi-Fi / QR links.
