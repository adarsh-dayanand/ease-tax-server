# Entities

## 1. User

- **Attributes:**
  - `user_id`, `name`, `email`, `pan`, `phone_verified`, `registration_date`, `profile_details`, `contact_number`
- **Relationships:**
  - Can create multiple ServiceRequests
  - Can upload multiple Documents
  - Can make multiple Payments
  - Can give multiple Feedback entries

## 2. Chartered Accountant (CA)

- **Attributes:**
  - `ca_id`, `name`, `email`, `experience_years`, `profile_details`, `phone_verified`, `registration_date`, `ratings`, `availability_status`
- **Relationships:**
  - Can accept/reject multiple ServiceRequests
  - Can be associated with multiple Meetings
  - Can receive multiple Payments
  - Can receive multiple Feedback entries

## 3. ServiceRequest

- **Attributes:**
  - `request_id`, `user_id`, `ca_id`, `status` (pending, accepted, rejected, completed, cancelled), `created_at`, `updated_at`, `deadline`, `cancellation_fee_due`
- **Relationships:**
  - Belongs to one User
  - Assigned to one CA (may be null until accepted)
  - Linked to multiple Documents
  - Linked to one or more Payments
  - Linked to one Meeting (scheduled interaction)

## 4. Document

- **Attributes:**
  - `document_id`, `owner_id` (User/CA), `request_id`, `filename`, `filetype`, `storage_url`, `upload_timestamp`, `verified_status`
- **Relationships:**
  - Belongs to User or CA
  - Linked to one ServiceRequest

## 5. Payment

- **Attributes:**
  - `payment_id`, `payer_id` (User), `payee_id` (CA), `amount`, `status` (pending, completed, refunded), `payment_type` (initial_booking, service_fee, cancellation_fee, commission), `payment_date`, `transaction_reference`
- **Relationships:**
  - Linked to one ServiceRequest
  - Associated with User (payer)
  - Associated with CA (payee)
  - Can be held in escrow (flag)

## 6. Meeting (VC Integration)

- **Attributes:**
  - `meeting_id`, `request_id`, `ca_id`, `user_id`, `meeting_link` (from third-party API), `scheduled_time`, `reschedule_allowed`, `status` (scheduled, rescheduled, cancelled, completed), `external_platform`
- **Relationships:**
  - Linked to one ServiceRequest
  - Linked to User and CA

## 7. Feedback

- **Attributes:**
  - `feedback_id`, `request_id`, `user_id`, `ca_id`, `rating`, `comment`, `submitted_at`
- **Relationships:**
  - Linked to User and CA
  - Linked to one completed ServiceRequest

---

## Entity Relationship Summary

- **User:** Creates ServiceRequests, uploads Documents, makes Payments, participates in Meetings, submits Feedback.
- **CA:** Accepts/handles ServiceRequests, receives Payments, participates in Meetings, receives Feedback.
- **ServiceRequest:** Central to flow; links User, CA, Documents, Payments, Meeting, and Feedback.
- **Document:** Attached to both User/CA and ServiceRequest to support secure exchange.
- **Payment:** Always linked to ServiceRequest; differentiates type and status clearly.
- **Meeting:** Handles scheduling via external VC, ensures connection between User/CA for filing process.
- **Feedback:** Lets User review CA, ties back to ServiceRequest for traceability.

---

## Entity Relationship Diagram (Textual)

- `User ⟶ (1..*) ServiceRequest`
- `CA ⟶ (0..*) ServiceRequest`
- `ServiceRequest ⟶ (0..*) Document`
- `ServiceRequest ⟶ (1..*) Payment`
- `ServiceRequest ⟶ (0..1) Meeting`
- `ServiceRequest ⟶ (0..1) Feedback`
- `Feedback ⟶ User, CA`
- `Meeting ⟶ User, CA`

---
