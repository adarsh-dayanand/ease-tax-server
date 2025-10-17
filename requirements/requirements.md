# EaseTax: MVP & Version 1 Project Requirement Document

## Overview

EaseTax connects users with Chartered Accountants (CAs) for ITR filing and basic financial planning. The MVP is focused on delivering core flows efficiently and reliably, prepared for heavy traffic, and optimized for web-only access.

---

## Functional Requirements

### User Workflow

- Account Management:

  - Social sign-in (Google)
  - Registration and profile setup, including KYC

- ITR Filing Process:
  - Upload Form16 (PDF/image, encrypted storage)
  - Search, select, and request CA by service type, ratings, availability
  - Receive notification when CA accepts/rejects
  - Pay initial booking fee (₹999, escrowed)
  - Share documents and queries via secure web chat
  - Option to reschedule VC meeting (with CA), via integration with external VC solutions (Zoom, Google Meet, Teams)—no built-in video or AI transcript
  - ITR filed, final document shared; pay remaining service fee (auto-calculated: 8% commission, the fees is uploaded by the CA itself.)
  - Option to cancel, with appropriate penalties (₹999 if CA has accepted)
  - Feedback and rating system
  - Notifications for deadlines, document uploads, payment status
  - Escalation to trusted EaseTax CA if initial CA does not accept in time.

### CA Workflow

- Account & Profile:

  - Register, update professional details and experience

- Service Handling:
  - Accept/reject service requests; fallback logic for deadlines
  - Schedule call with user via third-party VC (Google Meet, Zoom, Teams)
  - Dashboard to manage requests, payments, and user feedback
  - Mark service completion, submit final documentation
  - Receive payment after commission deduction

---

## Excluded Features (For MVP & Version 1)

- In-app video calling and conferencing functionality
- AI transcript detection/fraud monitoring capabilities
- Mobile app for iOS and Android (future phases only)

---

## Architecture & Technical Stack (Web-Only)

- Frontend: React or Next.js SPA, responsive for desktop/tablet
- Backend: Node.js/Express (modular monolith, microservice-ready), RESTful APIs (GraphQL optional for performance-critical endpoints)
- Authentication: Firebase Auth (Google only for MVP, extensible for phone/email), JWT middleware, not tightly coupled to Firebase
- Database: PostgreSQL (primary), Redis (caching, sessions, pub-sub), RabbitMQ (job queues)
- Document Storage: Google Drive API (MVP, free), AWS S3 (production), encrypted file uploads/downloads
- Third-party VC Integration: Google Meet or Zoom (free tier, API-based scheduling), extensible to other platforms
- Real-time Features: WebSocket (preferred), SSE as fallback, no third-party services
- Notifications: Email, SMS, in-app, using job queues (RabbitMQ)
- Payments: Razorpay/PhonePe/Cashfree (gateway to be finalized), escrow logic, commission calculation
- Hosting: AWS/GCP/Azure, scalable containers, load balancing
- Security: OAuth2, encrypted storage, HTTPS/SSL everywhere, input sanitization, rate limiting
- Monitoring & Logging: ELK stack, Prometheus/Grafana, Winston logging

---

## Scalability & Peak Traffic Management

- Horizontal scaling of backend/web servers (containers)
- Distributed request queues for payment, notifications, user requests
- Caching for user sessions and CA lists (Redis)
- CDN for fast document/media delivery
- System-wide rate limiting and circuit breakers
- Real-time alerts for deadlines and traffic spikes

---

## Key Edge Cases

- Multiple users requesting same CA (queue/prioritize)
- Document upload failures/retries
- Payment failures or rollbacks
- VC/meeting scheduling conflicts and rescheduling logic
- Deadline escalation if no CA accepts
- Cancellation policy enforcement depending on workflow stage
- Support for feedback and escalation

---

## References

- User, CA, and payment workflows
- Feature and communication details
- Business rules, including penalties

The EaseTax MVP is targeted, web-only, and relies on established third-party tools for VC and payment. It eliminates advanced features for rapid delivery, focusing instead on robustness, reliability, and ease of use during peak ITR season.

---

# EaseTax: MVP & Version 1 – Project Requirement Document (Updated)

## Scope Adjustment Summary

- Remove: In-app video call capabilities, AI transcript detection, mobile app development
- Add: Third-party VC integrations (Zoom, Google Meet, Teams)
- Platform: Web application only (responsive on desktop and tablet)

### Functional Requirements (Updated)

#### User Workflow

- Account Registration:

  - Social sign-in (Google, Apple, Facebook) and manual registration
  - Profile setup with mandatory KYC

- ITR Filing Process:

  - Secure upload of Form16
  - CA search, selection, request submission
  - Notification upon CA acceptance or rejection
  - Initial booking fee payment (₹1,000, held in escrow)
  - Document sharing and query resolution via secure web chat/messages
  - Scheduling VC meetings using integrated third-party tools (no native video call)
  - Rescheduling through linked third-party calendar invites
  - Final service document (ITR-V) and payment of balance (calculated: 8% returns/saved or ₹6,000, whichever is higher)
  - Feedback and rating post-completion

- Cancellation:

  - Charges apply if CA has worked post-acceptance (₹1,000 penalty)
  - Cancel and refund logic based on workflow stage

- Notifications:
  - Deadline reminders for filing, payment status alerts, and event updates via email/SMS/in-app

#### CA Workflow

- Registration and profile update
- Request management (accept/reject user requests; scheduling VC via third-party integration)
- Service management dashboard (requests, payments, feedback)
- Mark completion, issue documents, receive payment post-commission deduction
- Notifications for new requests, meetings, payment rollout

### Architecture & Scalability (Updated)

#### Technology Stack

- Frontend: React (SPA), responsive for desktop/tablet
- Backend: Node.js/Express (modular monolith, microservice-ready), RESTful APIs (GraphQL optional)
- Authentication: Firebase Auth (Google only for MVP, extensible for phone/email), JWT middleware
- Database: PostgreSQL (primary), Redis (caching, sessions, pub-sub), RabbitMQ (job queues)
- File Storage: Google Drive API (MVP, free), AWS S3 (production), encrypted file uploads/downloads
- VC Integration: Google Meet or Zoom (free tier, API-based scheduling)
- Payments: Razorpay/PhonePe/Cashfree (gateway to be finalized), escrow logic, commission calculation
- Notifications: Email/SMS/in-app, job queues (RabbitMQ)
- Security: OAuth2 login, HTTPS everywhere, encrypted data at rest, input sanitization, rate limiting
- Monitoring: ELK stack, Prometheus/Grafana, Winston logging

#### Traffic Handling

- Auto-scaling backend/API servers (Kubernetes or similar)
- Redis cache for active sessions, CA lists, notifications, and real-time pub-sub
- RabbitMQ for distributed job queues (notifications, payments)
- CDN for static files and document downloads
- Rate limiting, circuit breakers on public endpoints
- Failover queues and notification escalation logic during peak (March-September)

### Key Edge Cases (Updated)

- Multiple users requesting same CA—queue, prioritize, and time-out logic
- Document upload failures/retries with user feedback
- Payment issues—automated retry/escalation
- VC scheduling and rescheduling conflicts via integration calendar invites
- User/CA inactivity—escalation to EaseTax CA pool
- Cancellation policy enforcement—dynamic calculation and clear communication
- Real-time chat and notification delivery via WebSocket
- File storage fallback from Google Drive to S3 for production
- Authentication extensibility for future phone/email login
- Payment gateway flexibility for future business needs

---
