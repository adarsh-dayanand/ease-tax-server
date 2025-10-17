# Database Design - Proper Implementation

## Design Principles Applied

### 1. **Normalization** ✅
Data is properly normalized to avoid redundancy and maintain consistency.

### 2. **Single Source of Truth** ✅
Computed values (like ratings) are calculated from source data, not stored.

### 3. **Flexible Relationships** ✅
One-to-many relationships properly modeled for scalability.

---

## Table Structure

### **Users Table**
- Primary user entity
- Supports dual authentication: Phone+OTP and Google Auth
- Fields: `id`, `name`, `email`, `phone`, `pan`, `gstin`, `phoneVerified`, `profileImage`, `googleUid`

### **CAs Table** (Chartered Accountants)
- **Removed**: ❌ `rating`, `reviewCount` (computed from Reviews table)
- **Removed**: ❌ `price` (moved to CASpecialization table)
- **Removed**: ❌ `availability` (moved to CAAvailability table)
- **Added**: ✅ `email`, `phone`, `phoneVerified`, `googleUid` (CAs can also login)
- **Kept**: `name`, `location`, `image`, `verified`, `completedFilings`

### **CASpecialization Table** ✅
Maps CAs to their specializations with experience and fees.
- **Why?** A CA can have multiple specializations with different experience levels and fees
- Fields: `caId`, `specialization`, `experience`, `fees`, `isActive`
- Example: CA John can be expert in "Tax Filing" (5 years, ₹5000) and "GST" (3 years, ₹3000)

### **CAAvailability Table** ✅ NEW
Stores CA availability schedules.
- **Why?** CAs have multiple time slots across different days
- Fields: `caId`, `dayOfWeek`, `startTime`, `endTime`, `isActive`
- Example: Monday 9:00-17:00, Wednesday 10:00-14:00, Friday 9:00-17:00

### **Reviews Table** ✅
User reviews and ratings for CAs.
- Fields: `caId`, `userId`, `rating` (1-5), `review`, `isVerified`
- **This is the source of truth for ratings!**

---

## How to Get CA Ratings

### ❌ Wrong Way (Denormalized)
```javascript
// Storing rating in CA table leads to:
// - Data inconsistency
// - Manual updates needed
// - Sync issues between Reviews and CA tables
const ca = await CA.findByPk(caId);
console.log(ca.rating); // Could be outdated!
```

### ✅ Right Way (Computed)
```javascript
// Import the helper utility
const { getCAWithRating } = require('./utils/caRatingHelper');

// Ratings computed dynamically from Reviews table
const ca = await getCAWithRating(caId);
console.log(ca.averageRating); // Always accurate!
console.log(ca.reviewCount);    // Real-time count
```

---

## Benefits of This Design

1. **Data Integrity**: Rating is always accurate - computed from actual reviews
2. **No Sync Issues**: No need to update CA table when reviews are added/deleted
3. **Scalability**: Easy to add more review metrics (e.g., recent ratings, weighted ratings)
4. **Flexibility**: 
   - CAs can have multiple specializations
   - CAs can have multiple availability slots
   - Easy to filter/search by specialization or availability
5. **Single Responsibility**: Each table has one clear purpose

---

## Example Queries

### Get CA with all related data:
```javascript
const ca = await CA.findByPk(caId, {
  include: [
    { model: CASpecialization, as: 'specializations' },
    { model: CAAvailability, as: 'availabilities' },
    { model: Review, as: 'reviews', include: [{ model: User, as: 'user' }] }
  ]
});
```

### Get CAs available on Monday:
```javascript
const cas = await CA.findAll({
  include: [{
    model: CAAvailability,
    as: 'availabilities',
    where: { dayOfWeek: 'monday', isActive: true }
  }]
});
```

### Get CAs with specific specialization:
```javascript
const cas = await CA.findAll({
  include: [{
    model: CASpecialization,
    as: 'specializations',
    where: { specialization: 'Tax Filing', isActive: true }
  }]
});
```

---

## Migration Order

1. ✅ `20251016-create-user.js`
2. ✅ `20251016-create-ca.js` (updated - removed rating, price, availability)
3. ✅ `20251016-create-ca-specialization.js`
4. ✅ `20251016-create-review.js`
5. ✅ `20251016-create-ca-availability.js` (new)

---

## Summary

This is now a **proper, normalized database design** that:
- Avoids data duplication
- Maintains data integrity
- Scales well with business growth
- Follows database best practices
