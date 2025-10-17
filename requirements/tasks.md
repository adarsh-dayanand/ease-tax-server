# Backend User Stories & Tasks (Microservice Architecture)

## Auth Service

- Implement OAuth and email/password authentication endpoints (Google, Apple, Facebook, email).
- Manage JWT/refresh token issuance and validation.
- Provide user/CA authentication and session APIs for other services.

## User Service

- Build user profile management APIs (CRUD, KYC verification, status tracking).
- Store and serve user feedback/ratings for CAs.
- Provide user dashboard data (filings, payments, notifications).

## CA Service

- Build CA profile management APIs (CRUD, professional details, experience).
- Develop CA search/filter APIs (service type, ratings, availability).
- Implement CA request, acceptance/rejection, queueing/prioritization, and escalation logic.
- Provide CA dashboard data (requests, payments, feedback).

## Document Service

- Create endpoints for Form16 upload, encrypted S3 storage, and retrieval.
- Provide secure document sharing APIs for chat and ITR delivery.

## Payment Service

- Integrate payment APIs (Razorpay/Stripe) for booking/final fee, escrow logic, refunds, and commission deduction.
- Track payment status, escrow, and refund/cancellation logic.
- Provide payment history and status APIs for user/CA dashboards.

## Chat/Communication Service

- Build secure chat/message APIs for user-CA communication and document sharing.

## VC Scheduling Service

- Integrate third-party VC scheduling APIs (Zoom, Google Meet, Teams).
- Manage meeting scheduling/rescheduling, conflict detection, and escalation.

## Notification Service

- Implement notification system (email, SMS, in-app) with job queues (RabbitMQ/Kafka).
- Provide notification APIs for deadlines, uploads, payments, escalations.

## Orchestrator/API Gateway

- Route requests to appropriate microservices and enforce workflow/cancellation/refund policies.
- Aggregate data for dashboards and ensure security (OAuth2, HTTPS, encrypted storage).

## Monitoring & Edge Cases

- Monitor and log all critical events (ELK stack, Prometheus/Grafana).
- Add retry logic for failed uploads/payments and communicate status.
- Enforce and communicate cancellation/refund policies at each workflow stage.
- Handle all edge cases: queueing, retries, payment/VC/cancellation issues, escalation, and feedback.
