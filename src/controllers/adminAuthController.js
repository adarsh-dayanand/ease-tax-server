const firebaseConfig = require("../config/firebase");
const { Admin } = require("../../models");
const logger = require("../config/logger");

/**
 * Admin Google Authentication
 * SECURITY NOTE: Only pre-registered admin accounts can login
 */
exports.adminGoogleLogin = async (req, res) => {
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
    const { email, name, uid } = decodedToken;

    // Find admin (DO NOT create - admins must be pre-registered by super admin)
    let admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: {
          code: "ADMIN_NOT_FOUND",
          message: "Admin account not found. Please contact super admin.",
        },
      });
    }

    // Check admin status
    if (admin.status !== "active") {
      return res.status(401).json({
        success: false,
        error: {
          code: "ADMIN_INACTIVE",
          message: `Admin account is ${admin.status}. Please contact super admin.`,
        },
      });
    }

    // Update admin login info
    await admin.update({
      lastLogin: new Date(),
      googleUid: admin.googleUid || uid,
    });

    logger.info(`Admin logged in: ${email}`, {
      adminId: admin.id,
      role: admin.role,
    });

    // Return admin data (exclude sensitive fields)
    const adminData = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      permissions: admin.permissions,
      lastLogin: admin.lastLogin,
    };

    return res.json({
      success: true,
      data: {
        admin: adminData,
        message: "Admin login successful",
      },
    });
  } catch (err) {
    logger.error("Admin Google login failed", {
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

/**
 * Create first super admin (development only)
 */
exports.createSuperAdmin = async (req, res) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({
        success: false,
        error: {
          code: "ENDPOINT_NOT_AVAILABLE",
          message: "This endpoint is not available in production",
        },
      });
    }

    const { name, email, googleUid } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_REQUIRED_FIELDS",
          message: "Name and email are required",
        },
      });
    }

    // Check if any admin already exists
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        error: {
          code: "SUPER_ADMIN_EXISTS",
          message:
            "Super admin already exists. Use admin management endpoints.",
        },
      });
    }

    // Create first super admin
    const superAdmin = await Admin.create({
      name,
      email,
      googleUid,
      role: "super_admin",
      status: "active",
      permissions: {
        canManageCAs: true,
        canManageUsers: true,
        canViewAnalytics: true,
        canManageSystem: true,
        canManageAdmins: true,
      },
      metadata: {
        isInitialSuperAdmin: true,
        createdAt: new Date(),
      },
    });

    logger.info(`Super admin created: ${email}`, { adminId: superAdmin.id });

    return res.json({
      success: true,
      data: {
        admin: {
          id: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          role: superAdmin.role,
          status: superAdmin.status,
        },
        message: "Super admin created successfully",
      },
    });
  } catch (err) {
    logger.error("Super admin creation failed", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: "SUPER_ADMIN_CREATION_FAILED",
        message: "Failed to create super admin",
      },
    });
  }
};

/**
 * Get admin profile
 */
exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.user.id, {
      attributes: {
        exclude: ["createdAt", "updatedAt"],
      },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ADMIN_NOT_FOUND",
          message: "Admin not found",
        },
      });
    }

    return res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          status: admin.status,
          permissions: admin.permissions,
          lastLogin: admin.lastLogin,
        },
      },
    });
  } catch (err) {
    logger.error("Get admin profile failed", {
      error: err.message,
      adminId: req.user.id,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: "PROFILE_FETCH_FAILED",
        message: "Failed to fetch admin profile",
      },
    });
  }
};
