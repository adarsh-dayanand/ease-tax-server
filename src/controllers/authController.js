const firebaseConfig = require("../config/firebase");
const { User, CA, Admin } = require("../../models");
const { Op } = require("sequelize");
const logger = require("../config/logger");

exports.googleLoginOrRegister = async (req, res) => {
  logger.info("=== googleLoginOrRegister called ===", {
    method: req.method,
    path: req.path,
    hasIdToken: !!req.body.idToken,
  });

  try {
    const { idToken } = req.body;
    if (!idToken) {
      logger.warn("Missing idToken in request");
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_ID_TOKEN",
          message: "Firebase ID token is required",
        },
      });
    }

    logger.info("Attempting Firebase token verification", {
      tokenLength: idToken.length,
      tokenStart: idToken.substring(0, 20) + "...",
    });

    // Verify Google token
    const verificationResult = await firebaseConfig.verifyIdToken(idToken);

    if (!verificationResult.success) {
      logger.error("Firebase token verification failed", {
        error: verificationResult.error,
        tokenStart: idToken.substring(0, 20) + "...",
      });

      // Check if Firebase is configured
      if (verificationResult.error === "Firebase not configured") {
        return res.status(500).json({
          success: false,
          error: {
            code: "FIREBASE_NOT_CONFIGURED",
            message: "Firebase Admin SDK is not properly configured",
          },
        });
      }

      throw new Error(verificationResult.error);
    }

    const decodedToken = verificationResult.data;
    const { email, name, picture, uid } = decodedToken;
    // Validate required fields
    if (!email) {
      logger.error("Email missing from Firebase token", {
        tokenKeys: Object.keys(decodedToken),
      });
      throw new Error("Email is required but not found in token");
    }
    if (!uid) {
      logger.error("UID missing from Firebase token", {
        tokenKeys: Object.keys(decodedToken),
      });
      throw new Error("UID is required but not found in token");
    }

    // Ensure name has a value (required field in database)
    const userName = name ?? email.split("@")[0] ?? "User";

    logger.info("Firebase token verified successfully", {
      uid,
      email,
      name: userName,
      hasPicture: !!picture,
    });

    // Normalize email for lookup
    const normalizedEmail = email.trim().toLowerCase();
    logger.info("Looking up user by email", {
      originalEmail: email,
      normalizedEmail,
    });

    // Find or create user - try both email formats to be safe
    let userRecord = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (!userRecord) {
      logger.info("User not found by email, checking by googleUid", { uid });
      // Also check by googleUid in case email lookup missed it
      userRecord = await User.findOne({ where: { googleUid: uid } });
      if (userRecord) {
        logger.info("User found by googleUid", {
          userId: userRecord.id,
          email: userRecord.email,
          googleUid: userRecord.googleUid,
        });
      } else {
        logger.info(
          "User not found by email or googleUid - will create new user"
        );
      }
    } else {
      logger.info("User found by email", {
        userId: userRecord.id,
        email: userRecord.email,
        googleUid: userRecord.googleUid,
      });
    }

    if (!userRecord) {
      logger.info(`Creating new user: ${email}`, {
        email,
        name: userName,
        googleUid: uid,
        hasPicture: !!picture,
      });

      try {
        // Prepare user data
        const userData = {
          email: normalizedEmail,
          name: userName.trim(),
          googleUid: uid,
          profileImage: picture || null,
          lastLogin: new Date(),
          status: "active", // Explicitly set status
        };

        logger.info("Attempting to create user with data", {
          email: userData.email,
          name: userData.name,
          googleUid: userData.googleUid,
          hasGoogleUid: !!userData.googleUid,
          status: userData.status,
        });

        logger.info("Calling User.create() now...");
        userRecord = await User.create(userData);
        logger.info("User.create() completed", {
          userId: userRecord?.id,
          email: userRecord?.email,
        });

        // Reload the user to ensure we have the latest data from database
        await userRecord.reload();

        // Double-check: Query database directly to verify user exists
        const verifyUser = await User.findOne({
          where: { id: userRecord.id },
          raw: false,
        });

        if (!verifyUser) {
          logger.error(
            "User creation appeared to succeed but user not found in database",
            {
              userId: userRecord.id,
              email,
              googleUid: uid,
            }
          );
          throw new Error(
            "User creation failed - user not persisted to database"
          );
        }

        // Use the verified user record
        userRecord = verifyUser;

        logger.info(`New user registered via Google: ${email}`, {
          userId: userRecord.id,
          email: userRecord.email,
          name: userRecord.name,
          googleUid: userRecord.googleUid,
        });
      } catch (createError) {
        logger.error(`Failed to create user: ${email}`, {
          error: createError.message,
          stack: createError.stack,
          errorName: createError.name,
          errorCode: createError.code,
          sequelizeErrors: createError.errors,
          userData: {
            email,
            name: userName,
            googleUid: uid,
          },
        });

        // Handle unique constraint violations (e.g., if googleUid already exists)
        if (createError.name === "SequelizeUniqueConstraintError") {
          logger.warn(
            `User creation failed due to unique constraint: ${email}`,
            {
              error: createError.message,
              fields: createError.errors?.map((e) => e.path),
            }
          );

          // Try to find user by googleUid if email lookup failed
          userRecord = await User.findOne({ where: { googleUid: uid } });
          if (!userRecord) {
            // Try by email again
            userRecord = await User.findOne({ where: { email } });
          }

          if (userRecord) {
            logger.info(
              `Found existing user after constraint error: ${email}`,
              {
                userId: userRecord.id,
              }
            );
          } else {
            throw createError; // Re-throw if we can't find the user
          }
        } else {
          throw createError;
        }
      }
    } else {
      logger.info(`Existing user found: ${email}`, {
        userId: userRecord.id,
      });

      // Update last login and Google UID if not set
      const updateData = {
        lastLogin: new Date(),
      };

      if (!userRecord.googleUid) {
        updateData.googleUid = uid;
      }
      if (!userRecord.profileImage && picture) {
        updateData.profileImage = picture;
      }

      await userRecord.update(updateData);
      logger.info(`User logged in via Google: ${email}`, {
        userId: userRecord.id,
      });
    }

    // Reload user from database to ensure we have the latest data
    userRecord = await User.findByPk(userRecord.id);
    if (!userRecord) {
      logger.error("User not found after creation/update", {
        email,
        uid,
      });
      throw new Error("User not found in database after authentication");
    }

    logger.info("Preparing response for user", {
      userId: userRecord.id,
      email: userRecord.email,
      isNewUser: !userRecord.phone,
    });

    // Return user data (exclude sensitive fields)
    const responseData = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      phone: userRecord.phone,
      profileImage: userRecord.profileImage,
      pan: userRecord.pan,
      gstin: userRecord.gstin,
      phoneVerified: userRecord.phoneVerified,
      lastLogin: userRecord.lastLogin,
    };

    logger.info("Sending successful authentication response", {
      userId: userRecord.id,
      email: userRecord.email,
    });

    return res.json({
      success: true,
      data: {
        user: responseData,
        isNewUser: !userRecord.phone, // Assuming new users need to complete profile
      },
    });
  } catch (err) {
    logger.error("Google login/register failed", {
      error: err.message,
      stack: err.stack,
      tokenProvided: !!req.body.idToken,
      errorName: err.name,
      errorCode: err.code,
      sequelizeErrors: err.errors,
    });

    // Handle Sequelize validation errors
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "User data validation failed",
          details: err.errors?.map((e) => ({
            field: e.path,
            message: e.message,
          })),
        },
      });
    }

    // Handle Sequelize unique constraint errors
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        error: {
          code: "DUPLICATE_ENTRY",
          message: "User with this email or Google ID already exists",
          details: err.errors?.map((e) => ({
            field: e.path,
            message: e.message,
          })),
        },
      });
    }

    // Handle Sequelize database errors
    if (err.name === "SequelizeDatabaseError") {
      logger.error("Database error during user creation", {
        error: err.message,
        original: err.original,
      });
      return res.status(500).json({
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "Failed to save user to database",
          details:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        },
      });
    }

    // More specific error handling for Firebase errors
    if (err.code === "auth/id-token-expired") {
      return res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_EXPIRED",
          message: "Firebase token has expired",
        },
      });
    }

    if (err.code === "auth/invalid-id-token") {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN_FORMAT",
          message: "Firebase token format is invalid",
        },
      });
    }

    if (err.code === "auth/project-not-found") {
      return res.status(500).json({
        success: false,
        error: {
          code: "FIREBASE_PROJECT_ERROR",
          message: "Firebase project configuration error",
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred during authentication",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      },
    });
  }
};

exports.refreshFirebaseToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_REFRESH_TOKEN",
          message: "Refresh token is required",
        },
      });
    }

    logger.info("Attempting Firebase token refresh");

    // Refresh the token using Firebase
    const refreshResult = await firebaseConfig.refreshIdToken(refreshToken);

    if (!refreshResult.success) {
      logger.error("Firebase token refresh failed", {
        error: refreshResult.error,
      });

      return res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_REFRESH_FAILED",
          message: refreshResult.error || "Failed to refresh token",
        },
      });
    }

    logger.info("Firebase token refreshed successfully");

    return res.json({
      success: true,
      data: {
        idToken: refreshResult.data.idToken,
        refreshToken: refreshResult.data.refreshToken,
        expiresIn: refreshResult.data.expiresIn,
      },
    });
  } catch (err) {
    logger.error("Firebase token refresh error", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Token refresh failed",
      },
    });
  }
};

/**
 * Phone authentication for users
 * Handles both new user creation and existing user login
 * Also handles account linking (if user logged in with Google before)
 */
exports.phoneLoginOrRegister = async (req, res) => {
  try {
    const { idToken, name, email } = req.body; // name and email optional for profile completion
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_ID_TOKEN",
          message: "Firebase ID token is required",
        },
      });
    }

    // Verify phone auth token
    const verificationResult = await firebaseConfig.verifyIdToken(idToken);
    if (!verificationResult.success) {
      throw new Error(verificationResult.error);
    }
    const decodedToken = verificationResult.data;
    const { phone_number, uid } = decodedToken;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_PHONE",
          message: "Phone number not found in token",
        },
      });
    }

    logger.info("Phone auth attempt", {
      phone: phone_number,
      uid,
      hasName: !!name,
      hasEmail: !!email,
    });

    // Normalize phone number (remove spaces, ensure + prefix)
    const normalizedPhone = phone_number.startsWith("+")
      ? phone_number
      : `+${phone_number}`;

    // Extract just the digits for flexible matching
    const phoneDigits = normalizedPhone.replace(/\D/g, "");
    // Extract last 10 digits (assuming Indian numbers)
    const last10Digits = phoneDigits.slice(-10);

    // Build array of possible phone formats to search
    const phoneFormats = [normalizedPhone];
    if (last10Digits.length === 10) {
      phoneFormats.push(last10Digits); // Just 10 digits
      // Try common country codes if last 10 digits found
      // Note: This is a fallback for phone lookup, actual country code should come from user selection
      phoneFormats.push(`+91${last10Digits}`); // India (+91)
      phoneFormats.push(`+1${last10Digits}`); // US/Canada (+1)
      phoneFormats.push(`91${last10Digits}`); // 91 prefix without +
    }

    // Try to find user by phone number - search multiple formats
    let userRecord = null;
    
    // First try by phoneUid (most reliable)
    userRecord = await User.findOne({ where: { phoneUid: uid } });
    
    // If not found, try each phone format
    if (!userRecord && phoneFormats.length > 0) {
      for (const phoneFormat of phoneFormats) {
        userRecord = await User.findOne({ where: { phone: phoneFormat } });
        if (userRecord) {
          logger.info("Found user by phone format", { phoneFormat, userId: userRecord.id });
          break;
        }
      }
    }

    logger.info("Phone lookup attempt", {
      normalizedPhone,
      last10Digits,
      phoneFormats,
      found: !!userRecord,
      userId: userRecord?.id,
    });

    // If still not found and user has Google account, try to link by checking if phone matches
    // This handles the case where user logged in with Google first, then tries phone
    if (!userRecord && email) {
      const normalizedEmail = email.trim().toLowerCase();
      userRecord = await User.findOne({ where: { email: normalizedEmail } });
      
      // If found by email, link the phone number and phoneUid
      if (userRecord) {
        logger.info("Linking phone to existing Google account", {
          userId: userRecord.id,
          email: userRecord.email,
          phone: normalizedPhone,
        });
        
        await userRecord.update({
          phone: normalizedPhone,
          phoneUid: uid,
          phoneVerified: true,
          lastLogin: new Date(),
        });
      }
    }

    // If user not found, create new user (requires name and email)
    if (!userRecord) {
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          error: {
            code: "PROFILE_INCOMPLETE",
            message: "Name and email are required for new user registration",
            requiresProfileCompletion: true,
          },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      
      // Check if email already exists
      const existingUserByEmail = await User.findOne({
        where: { email: normalizedEmail },
      });
      
      if (existingUserByEmail) {
        return res.status(409).json({
          success: false,
          error: {
            code: "EMAIL_EXISTS",
            message: "An account with this email already exists. Please login with Google or use a different email.",
          },
        });
      }

      logger.info("Creating new user via phone auth", {
        phone: normalizedPhone,
        email: normalizedEmail,
        name,
      });

      try {
        userRecord = await User.create({
          phone: normalizedPhone,
          phoneUid: uid,
          email: normalizedEmail,
          name: name.trim(),
          phoneVerified: true,
          lastLogin: new Date(),
          status: "active",
        });

        logger.info("New user created via phone", {
          userId: userRecord.id,
          phone: normalizedPhone,
          email: normalizedEmail,
        });
      } catch (createError) {
        logger.error("Failed to create user via phone", {
          error: createError.message,
          phone: normalizedPhone,
        });

        if (createError.name === "SequelizeUniqueConstraintError") {
          // Try to find existing user
          userRecord = await User.findOne({
            where: { phone: normalizedPhone },
          });
          if (!userRecord) {
            userRecord = await User.findOne({ where: { phoneUid: uid } });
          }
          if (userRecord) {
            logger.info("Found existing user after constraint error");
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    } else {
      // Existing user - update phoneUid if not set, and update last login
      const updateData = {
        lastLogin: new Date(),
        phoneVerified: true,
      };

      if (!userRecord.phoneUid) {
        updateData.phoneUid = uid;
      }
      
      // Update phone number if it's different (normalize to include country code)
      // If stored phone doesn't match normalized format, update it
      const storedPhone = userRecord.phone || "";
      const storedPhoneDigits = storedPhone.replace(/\D/g, "");
      const normalizedPhoneDigits = normalizedPhone.replace(/\D/g, "");
      
      // If phones don't match (different formats), update to normalized format
      if (storedPhoneDigits !== normalizedPhoneDigits || !storedPhone.startsWith("+")) {
        updateData.phone = normalizedPhone;
      }
      
      // If profile is incomplete (missing name or email), update if provided
      if (name && !userRecord.name) {
        updateData.name = name.trim();
      }
      if (email && !userRecord.email) {
        const normalizedEmail = email.trim().toLowerCase();
        // Check if email is already taken by another user
        const emailExists = await User.findOne({
          where: { email: normalizedEmail },
        });
        if (!emailExists || emailExists.id === userRecord.id) {
          updateData.email = normalizedEmail;
        }
      }

      await userRecord.update(updateData);
      logger.info("User logged in via phone", {
        userId: userRecord.id,
        phone: normalizedPhone,
        hadPhone: !!userRecord.phone,
        phoneUpdated: !!updateData.phone,
      });
    }

    // Reload user to get latest data
    userRecord = await User.findByPk(userRecord.id);
    if (!userRecord) {
      throw new Error("User not found after creation/update");
    }

    // Check if profile is complete
    const isProfileComplete = userRecord.name && userRecord.email;
    const requiresProfileCompletion = !isProfileComplete;

    // Return user data
    const responseData = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      phone: userRecord.phone,
      profileImage: userRecord.profileImage,
      pan: userRecord.pan,
      gstin: userRecord.gstin,
      phoneVerified: userRecord.phoneVerified,
      lastLogin: userRecord.lastLogin,
    };

    return res.json({
      success: true,
      data: {
        user: responseData,
        isNewUser: !userRecord.phone || !userRecord.email,
        requiresProfileCompletion,
      },
    });
  } catch (err) {
    logger.error("Phone login/register failed", {
      error: err.message,
      stack: err.stack,
    });

    if (err.code === "auth/id-token-expired") {
      return res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_EXPIRED",
          message: "Firebase token has expired",
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: err.message || "Failed to authenticate via phone",
      },
    });
  }
};

exports.getProfileByIdToken = async (req, res) => {
  try {
    const email = req.user.email;
    const userType = req.user.type;

    let userRecord;

    switch (userType) {
      case "ca":
        userRecord = await CA.findOne({ where: { email } });
        break;
      case "user":
        userRecord = await User.findOne({ where: { email } });
        break;
      case "admin":
        userRecord = await Admin.findOne({ where: { email } });
        break;
      default:
        return res.status(404).json({
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
    }
    // Find user
    if (!userRecord) {
      return res.status(404).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      });
    }

    // Return user profile
    const userProfile = {
      id: userRecord?.id,
      email: userRecord?.email,
      name: userRecord?.name,
      phone: userRecord?.phone,
      countryCode: userRecord?.countryCode || null,
      profileImage: userRecord?.profileImage,
      pan: userRecord?.pan,
      gstin: userRecord?.gstin,
      phoneVerified: userRecord?.phoneVerified,
      lastLogin: userRecord?.lastLogin,
    };

    return res.json({
      success: true,
      data: {
        user: userProfile,
      },
    });
  } catch (err) {
    logger.error("Failed to get user profile", {
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get user profile",
      },
    });
  }
};
