const firebaseConfig = require("../config/firebase");
const { User, CA, Admin } = require("../../models");
const logger = require("../config/logger");

exports.googleLoginOrRegister = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
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

    logger.info("Firebase token verified successfully", {
      uid,
      email,
      name,
    });

    // Find or create user
    let userRecord = await User.findOne({ where: { email } });
    if (!userRecord) {
      userRecord = await User.create({
        email,
        name,
        googleUid: uid,
        profileImage: picture,
        lastLogin: new Date(),
      });
      logger.info(`New user registered via Google: ${email}`, {
        userId: userRecord.id,
      });
    } else {
      // Update last login and Google UID if not set
      await userRecord.update({
        lastLogin: new Date(),
        googleUid: userRecord.googleUid || uid,
        profileImage: userRecord.profileImage || picture,
      });
      logger.info(`User logged in via Google: ${email}`, {
        userId: userRecord.id,
      });
    }

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
    });

    // More specific error handling
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

    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid Firebase token",
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
