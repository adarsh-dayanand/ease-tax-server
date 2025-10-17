const { sequelize } = require("../models");

/**
 * Get CA with computed rating and review count (all reviews and verified only)
 * @param {string} caId - CA ID
 * @returns {Promise<Object>} CA with rating stats
 */
async function getCAWithRating(caId) {
  const { CA, Review } = require("../models");

  const ca = await CA.findByPk(caId, {
    include: [
      {
        model: Review,
        as: "reviews",
        attributes: [],
      },
    ],
    attributes: {
      include: [
        // All reviews
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn("AVG", sequelize.col("reviews.rating")),
            0
          ),
          "averageRating",
        ],
        [sequelize.fn("COUNT", sequelize.col("reviews.id")), "reviewCount"],
        // Verified reviews only
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn(
              "AVG",
              sequelize
                .case()
                .when(
                  sequelize.col("reviews.isVerified"),
                  sequelize.col("reviews.rating")
                )
                .else(null)
            ),
            0
          ),
          "verifiedRating",
        ],
        [
          sequelize.fn(
            "COUNT",
            sequelize
              .case()
              .when(
                sequelize.col("reviews.isVerified"),
                sequelize.col("reviews.id")
              )
              .else(null)
          ),
          "verifiedReviewCount",
        ],
      ],
    },
    group: ["CA.id"],
  });

  return ca;
}

/**
 * Get all CAs with computed ratings and review counts (all and verified)
 * @param {Object} options - Query options (limit, offset, where)
 * @returns {Promise<Array>} CAs with rating stats
 */
async function getAllCAsWithRatings(options = {}) {
  const { CA, Review } = require("../models");

  const cas = await CA.findAll({
    ...options,
    include: [
      {
        model: Review,
        as: "reviews",
        attributes: [],
      },
    ],
    attributes: {
      include: [
        // All reviews
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn("AVG", sequelize.col("reviews.rating")),
            0
          ),
          "averageRating",
        ],
        [sequelize.fn("COUNT", sequelize.col("reviews.id")), "reviewCount"],
        // Verified reviews only
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn(
              "AVG",
              sequelize
                .case()
                .when(
                  sequelize.col("reviews.isVerified"),
                  sequelize.col("reviews.rating")
                )
                .else(null)
            ),
            0
          ),
          "verifiedRating",
        ],
        [
          sequelize.fn(
            "COUNT",
            sequelize
              .case()
              .when(
                sequelize.col("reviews.isVerified"),
                sequelize.col("reviews.id")
              )
              .else(null)
          ),
          "verifiedReviewCount",
        ],
      ],
    },
    group: ["CA.id"],
    subQuery: false,
  });

  return cas;
}

/**
 * Get CAs sorted by verified rating (prioritizes verified reviews)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} CAs sorted by verified rating, then by all ratings
 */
async function getCAsOrderedByVerifiedRating(options = {}) {
  const cas = await getAllCAsWithRatings(options);

  return cas.sort((a, b) => {
    // First sort by verified rating (if both have verified reviews)
    if (
      a.dataValues.verifiedReviewCount > 0 &&
      b.dataValues.verifiedReviewCount > 0
    ) {
      if (a.dataValues.verifiedRating !== b.dataValues.verifiedRating) {
        return b.dataValues.verifiedRating - a.dataValues.verifiedRating;
      }
    }

    // If one has verified reviews and other doesn't, prioritize verified
    if (
      a.dataValues.verifiedReviewCount > 0 &&
      b.dataValues.verifiedReviewCount === 0
    ) {
      return -1;
    }
    if (
      b.dataValues.verifiedReviewCount > 0 &&
      a.dataValues.verifiedReviewCount === 0
    ) {
      return 1;
    }

    // Finally, sort by overall rating
    return b.dataValues.averageRating - a.dataValues.averageRating;
  });
}

/**
 * Get recent reviews for a CA (with verification status)
 * @param {string} caId - CA ID
 * @param {number} limit - Number of reviews to fetch
 * @param {boolean} verifiedOnly - If true, fetch only verified reviews
 * @returns {Promise<Array>} Recent reviews
 */
async function getRecentReviews(caId, limit = 10, verifiedOnly = false) {
  const { Review, User } = require("../models");

  const whereClause = { caId };
  if (verifiedOnly) {
    whereClause.isVerified = true;
  }

  const reviews = await Review.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["name", "profileImage"],
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
  });

  return reviews;
}

module.exports = {
  getCAWithRating,
  getAllCAsWithRatings,
  getCAsOrderedByVerifiedRating,
  getRecentReviews,
};
