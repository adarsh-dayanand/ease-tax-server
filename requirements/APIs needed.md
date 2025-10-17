# APIs Needed for Complete App Functionality

## API Response Formats & Schemas

### User

```ts
// User profile
interface UserState {
  id: string | null;
  name: string | null;
  email: string | null;
  avatar: string | null;
  phone?: string | null;
  role?: "user" | "ca" | null;
  pan?: string | null;
  gstin?: string | null;
  recentFilings: Array<{
    id: string;
    year: string;
    status: string;
    ca: string;
    filedDate: string;
    refundAmount: string;
  }>;
  loading: boolean;
  error: string | null;
}
```

### CA (Chartered Accountant)

```ts
// CA summary (list/search)
type CA = {
  id: string;
  name: string;
  specialization: string;
  experience: string;
  rating: number;
  reviewCount: number;
  location: string;
  price: string;
  availability: string;
  image: string;
  verified: boolean;
  completedFilings: number;
};

// CA profile (detailed)
interface CAProfile {
  bio: string;
  qualifications: string[];
  languages: string[];
  successRate: number;
  clientRetention: number;
  services: {
    name: string;
    price: string;
  }[];
  specialties: string[];
  availability: {
    days: string[];
    hours: string;
  };
  reviews: {
    id: number;
    name: string;
    avatar: string;
    rating: number;
    date: string;
    comment: string;
  }[];
}
```

### Consultation

```ts
type ConsultationType = "video" | "phone" | "chat";
type ConsultationStatus =
  | "upcoming"
  | "rejected"
  | "cancelled"
  | "no-show"
  | "itr-filed"
  | "itr-verified";
type PaymentStatus = "token-paid" | "paid" | "unpaid" | "refunded";

type Consultation = {
  id: string;
  caName: string;
  caImage?: string;
  caSpecialization?: string;
  date: string;
  time?: string;
  type: ConsultationType;
  purpose?: string;
  status: ConsultationStatus;
  paymentStatus: PaymentStatus;
  durationMinutes?: number;
  price?: number;
  currency?: string;
  notes?: string;
  progress: number; // 0-100
  createdAt?: string;
  updatedAt?: string;
};
```

### Document

```ts
type Document = {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  type: string;
};
```

### Message (Chat)

```ts
type Message = {
  id: string;
  sender: "user" | "ca";
  message: string;
  timestamp: string;
  hasAttachment?: boolean;
};
```

### Booking Data (Consultation Booking Request)

```ts
interface BookingData {
  ca_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  purpose: string;
  additional_notes: string;
}
```

### Example API Response Formats

#### GET /users/:userId

```json
{
  "id": "user_123",
  "name": "Amit Kumar",
  "email": "amit@email.com",
  "avatar": "https://...",
  "phone": "+91-9876543210",
  "role": "user",
  "pan": "ABCDE1234F",
  "gstin": null,
  "recentFilings": [
    {
      "id": "1",
      "year": "AY 2023-24",
      "status": "Filed",
      "ca": "CA Rajesh Kumar",
      "filedDate": "2024-03-15",
      "refundAmount": "₹15,000"
    }
  ],
  "loading": false,
  "error": null
}
```

#### GET /ca/:caId

```json
{
  "id": "1",
  "name": "CA Rajesh Kumar",
  "specialization": "Income Tax & GST",
  "experience": "8 years",
  "rating": 4.8,
  "reviewCount": 124,
  "location": "Mumbai, Maharashtra",
  "price": "₹2,500",
  "availability": "Available Today",
  "image": "https://...",
  "verified": true,
  "completedFilings": 450
}
```

#### GET /consultations/:consultationId

```json
{
  "id": "c_123",
  "caName": "CA Rajesh Kumar",
  "caImage": "https://...",
  "caSpecialization": "Tax Consultant",
  "date": "2024-03-25",
  "time": "10:00 AM",
  "type": "video",
  "purpose": "Discuss tax filing",
  "status": "upcoming",
  "paymentStatus": "paid",
  "durationMinutes": 30,
  "price": 5000,
  "currency": "INR",
  "progress": 10,
  "notes": "Please prepare your documents.",
  "createdAt": "2024-03-01T10:00:00Z",
  "updatedAt": "2024-03-01T10:00:00Z"
}
```

#### GET /consultations/:consultationId/messages

```json
[
  {
    "id": "1",
    "sender": "user",
    "message": "Hello, I have uploaded Form-16 and bank statements. Please review them.",
    "timestamp": "2 days ago"
  },
  {
    "id": "2",
    "sender": "ca",
    "message": "Thank you for sharing the documents. I have reviewed them.",
    "timestamp": "1 day ago"
  }
]
```

#### GET /consultations/:consultationId/documents

```json
[
  {
    "id": "1",
    "name": "Form-16_2023-24.pdf",
    "size": "245 KB",
    "uploadedAt": "2 days ago",
    "type": "pdf"
  },
  {
    "id": "2",
    "name": "Bank_Statement_March_2024.pdf",
    "size": "1.2 MB",
    "uploadedAt": "2 days ago",
    "type": "pdf"
  }
]
```

#### POST /users/consultations (Booking)

Request body:

```json
{
  "ca_id": "1",
  "date": "2024-03-25",
  "time": "10:00",
  "purpose": "Discuss tax filing",
  "additional_notes": "Please call before meeting."
}
```

Response:

```json
{
	"id": "c_123",
	... // Consultation object as above
}
```

#### GET /ca/:caId/reviews

```json
[
  {
    "id": 1,
    "name": "Amit Sharma",
    "avatar": "https://...",
    "rating": 5,
    "date": "2 weeks ago",
    "comment": "Excellent service! ..."
  }
]
```

## 1. Authentication APIs

- POST /auth/login — Login with phone/email/password or OAuth (Google)
- POST /auth/register — Register new user (user/CA)
- POST /auth/verify-otp — OTP verification for phone/email
- POST /auth/logout — Logout user
- GET /auth/session — Get current session/user info

## 2. User APIs

- GET /users/:userId — Fetch user profile
- PUT /users/:userId — Update user profile/KYC
- GET /users/:userId/consultations — List all consultations for user
- GET /users/:userId/filings — List all filings for user
- GET /users/:userId/payments — List all payments for user

## 3. CA (Chartered Accountant) APIs

- GET /ca — List/search/filter CAs (by location, specialty, etc.)
- GET /ca/:caId — Get CA details/profile
- GET /ca/:caId/reviews — Get reviews for a CA
- GET /ca/:caId/consultation-slots — Get available slots for booking
- POST /ca/:caId/request — Request consultation/queue position

## 4. Consultation APIs

- POST /users/consultations — Book a new consultation
- PUT /consultations/:consultationId/reschedule — Reschedule consultation
- POST /consultations/:consultationId/cancel — Cancel consultation
- GET /consultations/:consultationId — Get consultation details
- GET /consultations/:consultationId/messages — Get chat messages
- POST /consultations/:consultationId/messages — Send chat message
- GET /consultations/:consultationId/documents — List documents
- POST /consultations/:consultationId/documents — Upload document
- DELETE /consultations/:consultationId/documents/:docId — Delete document

## 5. Document APIs

- POST /documents/upload — Upload document (Form16, etc.)
- GET /documents/:docId/download — Download document
- GET /documents/:docId/status — Get document status

## 6. Payment APIs

- POST /payments/initiate — Initiate payment (booking/final fee)
- GET /payments/:paymentId/status — Get payment status
- GET /payments/history — Get payment history
- POST /payments/refund — Request refund/cancellation

## 7. Chat/Communication APIs

- GET /consultations/:consultationId/messages — Fetch chat messages
- POST /consultations/:consultationId/messages — Send message (text/file)
- GET /notifications — Fetch notifications (in-app, email, SMS)

## 8. VC Scheduling APIs

- POST /vc/schedule — Schedule video call (Zoom/Google Meet)
- PUT /vc/:meetingId/reschedule — Reschedule meeting
- GET /vc/:meetingId/status — Get meeting status/details

## 9. Notification APIs

- GET /notifications — List notifications
- POST /notifications/mark-read — Mark notification as read

---

- Endpoints may be grouped or split further based on backend design.
- Some endpoints (e.g., /auth/_, /payments/_, /vc/\*) may be handled by third-party services (Firebase, Razorpay, Zoom, etc.).
- All endpoints should be secured and require authentication where appropriate.
