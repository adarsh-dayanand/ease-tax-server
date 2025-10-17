const firebaseConfig = require("../config/firebase");
const { User } = require("../../models");
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
