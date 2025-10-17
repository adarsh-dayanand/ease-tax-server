const firebaseConfig = require("../config/firebase");
const { CA } = require("../../models");
const logger = require("../config/logger");

/**
 * SECURITY NOTE: CAs cannot self-register through this endpoint.
 * CA accounts must be pre-created by admin through the admin panel.
 * This endpoint only allows login for existing CA accounts.
 */
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

    // Verify Google token
    const verificationResult = await firebaseConfig.verifyIdToken(idToken);
    if (!verificationResult.success) {
      throw new Error(verificationResult.error);
    }
    const decodedToken = verificationResult.data;
    const { email, name, picture, uid } = decodedToken;

    // Find CA (DO NOT create - CAs must be pre-registered by admin)
    let ca = await CA.findOne({ where: { email } });
    if (!ca) {
      return res.status(401).json({
        success: false,
        error: {
          code: "CA_NOT_REGISTERED",
          message:
            "CA account not found. Please contact admin for registration.",
        },
      });
    }

    // Update existing CA - login and Google UID if not set
    await ca.update({
      lastLogin: new Date(),
      googleUid: ca.googleUid || uid,
      image: ca.image || picture,
    });
    logger.info(`CA logged in via Google: ${email}`, { caId: ca.id });

    // Return CA data (exclude sensitive fields)
    const caData = {
      id: ca.id,
      name: ca.name,
      email: ca.email,
      phone: ca.phone,
      location: ca.location,
      image: ca.image,
      verified: ca.verified,
      completedFilings: ca.completedFilings,
      phoneVerified: ca.phoneVerified,
      lastLogin: ca.lastLogin,
    };

    return res.json({
      success: true,
      data: {
        ca: caData,
        isNewCA: !ca.phone, // Assuming new CAs need to complete profile
        requiresVerification: !ca.verified,
      },
    });
  } catch (err) {
    logger.error("CA Google login/register failed", {
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

    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid Firebase token",
      },
    });
  }
};

exports.phoneLogin = async (req, res) => {
  try {
    const { idToken } = req.body; // Firebase phone auth also provides idToken
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_ID_TOKEN",
          message: "Firebase ID token is required for phone auth",
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

    // Find CA by phone
    let ca = await CA.findOne({ where: { phone: phone_number } });
    if (!ca) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CA_NOT_FOUND",
          message:
            "CA not found with this phone number. Please register first.",
        },
      });
    }

    // Update last login and phone verification
    await ca.update({
      lastLogin: new Date(),
      phoneVerified: true,
    });

    logger.info(`CA logged in via phone: ${phone_number}`, { caId: ca.id });

    // Return CA data
    const caData = {
      id: ca.id,
      name: ca.name,
      email: ca.email,
      phone: ca.phone,
      location: ca.location,
      image: ca.image,
      verified: ca.verified,
      completedFilings: ca.completedFilings,
      phoneVerified: ca.phoneVerified,
      lastLogin: ca.lastLogin,
    };

    return res.json({
      success: true,
      data: {
        ca: caData,
      },
    });
  } catch (err) {
    logger.error("CA phone login failed", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid phone verification token",
      },
    });
  }
};

/**
 * Endpoint for CA registration requests (requires admin approval)
 */
exports.requestCARegistration = async (req, res) => {
  try {
    const { name, email, phone, location, specializations, documents } =
      req.body;

    if (!name || !email || !phone || !location) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_REQUIRED_FIELDS",
          message: "Name, email, phone, and location are required",
        },
      });
    }

    // Check if CA already exists or has a pending request
    const existingCA = await CA.findOne({ where: { email } });
    if (existingCA) {
      return res.status(409).json({
        success: false,
        error: {
          code: "CA_ALREADY_EXISTS",
          message: "CA with this email already exists or has a pending request",
        },
      });
    }

    // Store the registration request (this would typically go to a separate table)
    // For now, we'll create an unverified CA record with special metadata
    const caRequest = await CA.create({
      name,
      email,
      phone,
      location,
      verified: false,
      status: "pending_registration",
      metadata: {
        registrationRequest: true,
        requestedAt: new Date(),
        specializations: specializations || [],
        documents: documents || [],
        source: "self_request",
      },
    });

    logger.info(`New CA registration request: ${email}`, {
      caId: caRequest.id,
      phone,
      location,
    });

    return res.json({
      success: true,
      data: {
        message: "CA registration request submitted successfully",
        requestId: caRequest.id,
        status: "pending_admin_review",
      },
    });
  } catch (err) {
    logger.error("CA registration request failed", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: "REGISTRATION_REQUEST_FAILED",
        message: "Failed to submit registration request",
      },
    });
  }
};
