const admin = require("firebase-admin");

class FirebaseConfig {
  constructor() {
    this.app = null;
    this.auth = null;
    this.initialized = false;
  }

  initialize() {
    try {
      if (this.initialized) {
        return this.app;
      }

      // For development, we'll skip Firebase initialization if env vars are not set
      const requiredVars = [
        "FIREBASE_PROJECT_ID",
        "FIREBASE_PRIVATE_KEY",
        "FIREBASE_CLIENT_EMAIL",
        "FIREBASE_API_KEY",
      ];
      const missingVars = requiredVars.filter(
        (varName) => !process.env[varName]
      );

      if (missingVars.length > 0) {
        console.log(
          `⚠️  Firebase not configured. Missing: ${missingVars.join(", ")}`
        );
        return null;
      }

      // Firebase Admin SDK configuration
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri:
          process.env.FIREBASE_AUTH_URI ||
          "https://accounts.google.com/o/oauth2/auth",
        token_uri:
          process.env.FIREBASE_TOKEN_URI ||
          "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: `https://www.googleapis.com/oauth2/v1/certs`,
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`,
      };

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      this.auth = this.app.auth();
      this.initialized = true;

      console.log("✅ Firebase Admin SDK initialized successfully");
      return this.app;
    } catch (error) {
      console.error("❌ Failed to initialize Firebase Admin SDK:", error);
      throw error;
    }
  }

  getAuth() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.auth;
  }

  getApp() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.app;
  }

  // Verify Firebase ID token
  async verifyIdToken(idToken) {
    try {
      if (!this.initialized) {
        const initResult = this.initialize();
        if (!initResult) {
          return {
            success: false,
            error: "Firebase not configured - missing environment variables",
          };
        }
      }

      if (!this.auth) {
        return {
          success: false,
          error: "Firebase Auth not available",
        };
      }

      // Log token verification attempt in development
      if (process.env.NODE_ENV === "development") {
        console.log("Verifying Firebase ID token...");
      }

      const decodedToken = await this.auth.verifyIdToken(idToken);

      if (process.env.NODE_ENV === "development") {
        console.log("Firebase token verified successfully:", {
          uid: decodedToken.uid,
          email: decodedToken.email,
          provider: decodedToken.firebase?.sign_in_provider,
        });
      }

      return {
        success: true,
        data: decodedToken,
      };
    } catch (error) {
      console.error("Firebase token verification failed:", {
        code: error.code,
        message: error.message,
        tokenStart: idToken?.substring(0, 20) + "...",
      });

      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Refresh Firebase ID token using refresh token
  async refreshIdToken(refreshToken) {
    try {
      if (!this.initialized) {
        const initResult = this.initialize();
        if (!initResult) {
          return {
            success: false,
            error: "Firebase not configured - missing environment variables",
          };
        }
      }

      // Use Firebase Auth REST API to refresh token
      const response = await fetch(
        `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || "Failed to refresh token",
          code: errorData.error?.code,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          idToken: data.id_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        },
      };
    } catch (error) {
      console.error("Firebase token refresh failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get user by UID
  async getUserByUid(uid) {
    try {
      const userRecord = await this.auth.getUser(uid);
      return {
        success: true,
        user: userRecord,
      };
    } catch (error) {
      logger.error("Failed to get user by UID:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get user by email
  async getUserByEmail(email) {
    try {
      const userRecord = await this.auth.getUserByEmail(email);
      return {
        success: true,
        user: userRecord,
      };
    } catch (error) {
      logger.error("Failed to get user by email:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Create user
  async createUser(userProperties) {
    try {
      const userRecord = await this.auth.createUser(userProperties);
      return {
        success: true,
        user: userRecord,
      };
    } catch (error) {
      logger.error("Failed to create user:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Update user
  async updateUser(uid, properties) {
    try {
      const userRecord = await this.auth.updateUser(uid, properties);
      return {
        success: true,
        user: userRecord,
      };
    } catch (error) {
      logger.error("Failed to update user:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Delete user
  async deleteUser(uid) {
    try {
      await this.auth.deleteUser(uid);
      return {
        success: true,
      };
    } catch (error) {
      logger.error("Failed to delete user:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Set custom user claims (for role-based access)
  async setCustomUserClaims(uid, customClaims) {
    try {
      await this.auth.setCustomUserClaims(uid, customClaims);
      return {
        success: true,
      };
    } catch (error) {
      logger.error("Failed to set custom user claims:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Generate email verification link
  async generateEmailVerificationLink(email, actionCodeSettings = null) {
    try {
      const link = await this.auth.generateEmailVerificationLink(
        email,
        actionCodeSettings
      );
      return {
        success: true,
        link,
      };
    } catch (error) {
      logger.error("Failed to generate email verification link:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Generate password reset link
  async generatePasswordResetLink(email, actionCodeSettings = null) {
    try {
      const link = await this.auth.generatePasswordResetLink(
        email,
        actionCodeSettings
      );
      return {
        success: true,
        link,
      };
    } catch (error) {
      logger.error("Failed to generate password reset link:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Create singleton instance
const firebaseConfig = new FirebaseConfig();

module.exports = firebaseConfig;
