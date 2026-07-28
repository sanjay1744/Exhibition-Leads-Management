# ⚡ Offline-First Exhibition Lead Capture Platform

[![Angular](https://img.shields.io/badge/Angular-21-dd0031.svg?logo=angular)](https://angular.dev/)
[![.NET](https://img.shields.io/badge/.NET-9.0-512bd4.svg?logo=dotnet)](https://dotnet.microsoft.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline--First-5A0FC8.svg?logo=pwa)](https://web.dev/progressive-web-apps/)
[![Dexie](https://img.shields.io/badge/Dexie-IndexedDB-blue.svg)](https://dexie.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade **Offline-First Lead Capture & Digital Business Exchange Platform** built for sales representatives operating in high-density, network-constrained trade fairs, expos, and conferences.

---

## 🌟 Key Features

- 📱 **Multi-Method Offline Lead Capture**:
  - **Business Card OCR Scanner**: On-device text extraction (<5s) using Tesseract.js WebAssembly.
  - **vCard & QR Code Scanner**: Offline parsing of visitor vCards & URLs using `html5-qrcode` (<2s).
  - **Voice Note Recorder**: Audio recording & local IndexedDB storage using `MediaRecorder` API.
  - **Lead Qualification Form**: Angular 21 Reactive Form supporting Hot/Warm/Cold scoring and priority tracking.
- 🔄 **Automatic Background Sync Engine**:
  - Offline leads are committed locally to **Dexie.js (IndexedDB)** with zero data loss.
  - Detects network availability and automatically batch uploads pending leads to ASP.NET Core Web API (`POST /api/v1/leads/sync`).
  - Automatic E.164 phone number & email deduplication.
- 📇 **Digital Business Exchange**:
  - Renders offline vCard 3.0 QR codes for instant contact sharing with visitors.
  - Offline PDF product catalog & brochure delivery.
- 📊 **Real-Time Analytics & Executive Dashboards**:
  - Sales Rep view: Lead counts, interest level distribution, pending vs. synced status.
  - Executive view: Event ROI metrics and capture method breakdown.

---

## 🛠️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND PWA (Angular 21)                                │
│   - Angular 21 Standalone Components & Signals                                          │
│   - Dexie.js (IndexedDB Encrypted Local Repository)                                     │
│   - Client-side Wasm OCR (Tesseract.js) & QR Reader (html5-qrcode)                      │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │ (Background Sync Worker)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND SERVER (.NET 9 Web API)                            │
│   - ASP.NET Core 9 C# Controllers                                                        │
│   - Entity Framework Core 9 + PostgreSQL Database                                       │
│   - Transactional Batch Sync & Deduplication Engine                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ & npm
- [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)

### 1. Run Frontend (Angular 21 PWA)
```bash
cd client
npm install
npm start
```
👉 Application runs at: `http://localhost:4200`

### 2. Run Backend (.NET 9 Web API)
```bash
cd server
dotnet run --project src/ExhibitionLeads.Api
```
👉 API & Swagger Docs run at: `http://localhost:5000/swagger`

---

## 📋 Spec Kit Workflow Framework

This project follows **GitHub Spec Kit (Specification-Driven Development)**:
- `.specify/memory/constitution.md` — Project Rules & Tech Stack Mandate.
- `.specify/specs/spec.md` — Detailed Functional Specifications.
- `.specify/plan.md` — Technical Architecture Plan.
- `.specify/tasks/task-list.md` — Implementation Task Breakdown.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
