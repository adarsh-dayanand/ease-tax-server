const AWS = require("aws-sdk");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { Document } = require("../../models");
const logger = require("../config/logger");

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "ap-south-1",
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "ease-taax";

// Multer configuration for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allowed file types from .env
  const allowedTypes = (
    process.env.ALLOWED_FILE_TYPES || "pdf,doc,docx,jpg,jpeg,png"
  ).split(",");
  const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);

  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type .${fileExtension} not allowed. Allowed types: ${allowedTypes.join(", ")}`,
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024, // Convert MB to bytes
  },
});

class DocumentService {
  constructor() {
    this.s3 = s3;
    this.bucketName = BUCKET_NAME;
  }
  /**
   * Upload document to S3
   */
  async uploadDocument(
    file,
    serviceRequestId,
    uploadedBy,
    uploaderType,
    fileType,
  ) {
    try {
      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${serviceRequestId}/${crypto.randomUUID()}${fileExtension}`;

      // Encrypt file if needed (optional - S3 can handle encryption)
      const encryptionKey = this.generateEncryptionKey();

      // Upload to S3
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: "AES256", // S3 server-side encryption
        Metadata: {
          "original-name": file.originalname,
          "uploaded-by": uploadedBy,
          "uploader-type": uploaderType,
          "file-type": fileType,
          "service-request-id": serviceRequestId,
        },
      };

      const result = await s3.upload(uploadParams).promise();

      // Save document record to database
      const document = await Document.create({
        serviceRequestId,
        uploadedBy,
        uploaderType,
        filename: fileName,
        originalName: file.originalname,
        fileType,
        mimeType: file.mimetype,
        fileSize: file.size,
        storageUrl: result.Location,
        storageProvider: "s3",
        isEncrypted: true,
        encryptionKey: encryptionKey,
        status: "uploaded",
        metadata: {
          s3Key: result.Key,
          s3ETag: result.ETag,
        },
      });

      return {
        id: document.id,
        name: document.originalName,
        size: this.formatFileSize(document.fileSize),
        uploadedAt: document.createdAt,
        type: document.fileType,
        url: result.Location,
      };
    } catch (error) {
      logger.error("Error uploading document:", error);
      throw error;
    }
  }

  /**
   * Upload ITR-V document (CA only, after service completion)
   */
  async uploadITRVDocument(file, serviceRequestId, uploadedBy) {
    try {
      // Verify that the uploader is the assigned CA
      const ServiceRequest = require("../../models").ServiceRequest;
      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId);

      if (!serviceRequest) {
        throw new Error("Service request not found");
      }

      if (serviceRequest.caId !== uploadedBy) {
        throw new Error("Only the assigned CA can upload ITR-V documents");
      }

      if (serviceRequest.status !== "completed") {
        throw new Error("ITR-V can only be uploaded after service completion");
      }

      return await this.uploadDocument(
        file,
        serviceRequestId,
        uploadedBy,
        "ca",
        "itr_v",
      );
    } catch (error) {
      logger.error("Error uploading ITR-V document:", error);
      throw error;
    }
  }

  /**
   * Upload document to consultation
   */
  async uploadConsultationDocument(consultationId, userId, file, documentType) {
    try {
      // Verify user has access to consultation
      const ServiceRequest = require("../../models").ServiceRequest;
      const consultation = await ServiceRequest.findByPk(consultationId);

      if (!consultation) {
        throw new Error("Consultation not found");
      }

      if (consultation.userId !== userId && consultation.caId !== userId) {
        throw new Error("Access denied");
      }

      // Determine uploader type
      const uploaderType = consultation.userId === userId ? "user" : "ca";

      // Upload the document
      const document = await this.uploadDocument(
        file,
        consultationId,
        userId,
        uploaderType,
        documentType,
      );

      // Send real-time notification to the other party
      const notificationService = require("./notificationService");
      const recipientId =
        consultation.userId === userId
          ? consultation.caId
          : consultation.userId;
      const recipientType = consultation.userId === userId ? "ca" : "user";

      await notificationService.notifyDocumentUploaded(
        recipientId,
        recipientType,
        {
          id: document.id,
          name: document.name,
          serviceRequestId: consultationId,
        },
      );

      return document;
    } catch (error) {
      logger.error("Error uploading consultation document:", error);
      throw error;
    }
  }

  /**
   * Download document from S3 - with payment access control
   */
  async downloadDocument(documentId, userId) {
    try {
      const document = await Document.findByPk(documentId);

      if (!document) {
        throw new Error("Document not found");
      }

      // Check if document is deleted
      if (document.status === "deleted") {
        throw new Error("Document has been deleted");
      }

      // Check access permissions (user should be part of the service request)
      const ServiceRequest = require("../../models").ServiceRequest;
      const Payment = require("../../models").Payment;

      const serviceRequest = await ServiceRequest.findByPk(
        document.serviceRequestId,
        {
          include: [
            {
              model: Payment,
              as: "payments",
              required: false,
            },
          ],
        },
      );

      if (!serviceRequest) {
        throw new Error("Service request not found");
      }

      // Basic access check - user or assigned CA
      if (serviceRequest.userId !== userId && serviceRequest.caId !== userId) {
        throw new Error("Access denied");
      }

      // Special handling for ITR-V documents
      if (
        document.fileType === "itr_v" ||
        document.originalName.toLowerCase().includes("itr-v")
      ) {
        // ITR-V can only be downloaded by user and only after final payment
        if (serviceRequest.caId === userId) {
          throw new Error("CAs cannot download ITR-V documents");
        }

        const finalPayment = serviceRequest.payments?.find(
          (p) => p.paymentType === "service_fee" && p.status === "completed",
        );

        if (!finalPayment) {
          throw new Error(
            "ITR-V download requires completion of final payment",
          );
        }
      }

      // If user is the CA, they can only access documents AFTER escrow payment is made
      if (serviceRequest.caId === userId) {
        const hasEscrowPayment = serviceRequest.payments?.some(
          (p) => p.paymentType === "booking_fee" && p.status === "completed",
        );

        if (!hasEscrowPayment) {
          throw new Error(
            "Access denied - escrow payment required for CA to access documents",
          );
        }
      }

      // Check if document has S3 metadata
      if (!document.metadata || !document.metadata.s3Key) {
        logger.error("Document missing S3 metadata", {
          documentId,
          hasMetadata: !!document.metadata,
          metadata: document.metadata,
        });
        throw new Error("Document storage information not found");
      }

      // Generate presigned URL for secure download
      const downloadParams = {
        Bucket: BUCKET_NAME,
        Key: document.metadata.s3Key,
        Expires: 3600, // URL expires in 1 hour
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(document.originalName)}"`,
      };

      let downloadUrl;
      try {
        downloadUrl = s3.getSignedUrl("getObject", downloadParams);
      } catch (s3Error) {
        logger.error("Error generating S3 presigned URL", {
          error: s3Error.message,
          bucket: BUCKET_NAME,
          key: document.metadata.s3Key,
        });
        throw new Error("Failed to generate download URL");
      }

      // Update download count and last accessed
      await document.update({
        downloadCount: document.downloadCount + 1,
        lastAccessedAt: new Date(),
      });

      return {
        downloadUrl,
        filename: document.originalName,
        fileSize: document.fileSize,
        contentType: document.mimeType,
      };
    } catch (error) {
      logger.error("Error downloading document:", error);
      throw error;
    }
  }

  /**
   * Get documents for a service request - with payment access control
   */
  async getServiceRequestDocuments(serviceRequestId, requestingUserId) {
    try {
      // Check access permissions first
      const ServiceRequest = require("../../models").ServiceRequest;
      const Payment = require("../../models").Payment;

      const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
        include: [
          {
            model: Payment,
            as: "payments",
            where: {
              paymentType: "booking_fee",
              status: "completed",
            },
            required: false,
            attributes: ["id", "amount", "status", "paymentType", "createdAt"],
          },
        ],
      });

      if (!serviceRequest) {
        throw new Error("Service request not found");
      }

      // Basic access check
      if (
        serviceRequest.userId !== requestingUserId &&
        serviceRequest.caId !== requestingUserId
      ) {
        throw new Error("Access denied");
      }

      // If user is the CA, they can only access documents AFTER escrow payment is made
      if (serviceRequest.caId === requestingUserId) {
        const hasEscrowPayment =
          serviceRequest.payments && serviceRequest.payments.length > 0;
        if (!hasEscrowPayment) {
          throw new Error(
            "Access denied - escrow payment required for CA to access documents",
          );
        }
      }

      const documents = await Document.findAll({
        where: {
          serviceRequestId,
          status: { [Op.ne]: "deleted" },
        },
        order: [["createdAt", "DESC"]],
      });

      return documents.map((doc) => ({
        id: doc.id,
        name: doc.originalName,
        size: this.formatFileSize(doc.fileSize),
        uploadedAt: doc.createdAt,
        type: doc.fileType,
        status: doc.status,
        mimeType: doc.mimeType,
        uploadedBy: doc.uploadedBy,
        uploaderType: doc.uploaderType,
      }));
    } catch (error) {
      logger.error("Error getting service request documents:", error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId, userId) {
    try {
      const document = await Document.findByPk(documentId);

      if (!document) {
        throw new Error("Document not found");
      }

      // Check if document is already deleted
      if (document.status === "deleted") {
        throw new Error("Document has already been deleted");
      }

      // Check access permissions - ONLY the uploader can delete
      if (document.uploadedBy !== userId) {
        logger.warn("Document deletion denied - not the uploader", {
          documentId,
          userId,
          uploadedBy: document.uploadedBy,
        });
        throw new Error(
          "Access denied - only the uploader can delete this document",
        );
      }

      // Delete from S3 if metadata exists
      if (document.metadata && document.metadata.s3Key) {
        try {
          const deleteParams = {
            Bucket: BUCKET_NAME,
            Key: document.metadata.s3Key,
          };

          await s3.deleteObject(deleteParams).promise();
          logger.info("Document deleted from S3", {
            documentId,
            s3Key: document.metadata.s3Key,
          });
        } catch (s3Error) {
          // Log S3 deletion error but continue with database deletion
          logger.error("Error deleting document from S3", {
            error: s3Error.message,
            documentId,
            s3Key: document.metadata.s3Key,
          });
          // Don't throw - we'll still mark it as deleted in DB
        }
      } else {
        logger.warn("Document missing S3 metadata, skipping S3 deletion", {
          documentId,
          hasMetadata: !!document.metadata,
        });
      }

      // Mark as deleted in database (soft delete)
      await document.update({
        status: "deleted",
        deletedAt: new Date(),
      });

      logger.info("Document marked as deleted", {
        documentId,
        userId,
        serviceRequestId: document.serviceRequestId,
      });

      return { success: true, message: "Document deleted successfully" };
    } catch (error) {
      logger.error("Error deleting document:", {
        error: error.message,
        stack: error.stack,
        documentId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Verify document (CA only)
   */
  async verifyDocument(documentId, caId, status, rejectionReason = null) {
    try {
      const document = await Document.findByPk(documentId);

      if (!document) {
        throw new Error("Document not found");
      }

      // Check if CA is assigned to this service request
      const ServiceRequest = require("../../models").ServiceRequest;
      const serviceRequest = await ServiceRequest.findByPk(
        document.serviceRequestId,
      );

      if (!serviceRequest || serviceRequest.caId !== caId) {
        throw new Error(
          "Access denied - only assigned CA can verify documents",
        );
      }

      const updateData = {
        status,
        verifiedBy: caId,
        verifiedAt: new Date(),
      };

      if (status === "rejected" && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      await document.update(updateData);

      // Send real-time notification about document verification
      const notificationService = require("./notificationService");
      const consultation = await ServiceRequest.findByPk(
        document.serviceRequestId,
      );

      if (consultation) {
        const notificationType =
          status === "verified" ? "document_verified" : "document_rejected";
        const title =
          status === "verified" ? "Document Verified" : "Document Rejected";
        const message =
          status === "verified"
            ? `Your document "${document.originalName}" has been verified`
            : `Your document "${document.originalName}" was rejected${rejectionReason ? `: ${rejectionReason}` : ""}`;

        await notificationService.createNotification(
          consultation.userId,
          "user",
          notificationType,
          title,
          message,
          {
            serviceRequestId: document.serviceRequestId,
            actionUrl: `/consultations/${document.serviceRequestId}/documents`,
            actionText: "View Documents",
            priority: "medium",
            templateData: {
              documentName: document.originalName,
              rejectionReason: rejectionReason,
            },
          },
        );
      }

      return await this.getServiceRequestDocuments(document.serviceRequestId);
    } catch (error) {
      logger.error("Error verifying document:", error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString("hex");
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  formatTimestamp(date) {
    const now = new Date();
    const docDate = new Date(date);
    const diffTime = Math.abs(now - docDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    return docDate.toLocaleDateString();
  }

  /**
   * Get user documents
   */
  async getUserDocuments(userId, page = 1, limit = 10, documentType = null) {
    try {
      const { Op } = require("sequelize");
      const ServiceRequest = require("../../models").ServiceRequest;
      const offset = (page - 1) * limit;

      const whereClause = {
        uploadedBy: userId,
        status: { [Op.ne]: "deleted" }, // Exclude deleted documents
      };

      if (documentType) {
        whereClause.fileType = documentType;
      }

      const { rows, count } = await Document.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: ServiceRequest,
            as: "serviceRequest",
            attributes: ["id", "status"],
            required: false,
          },
        ],
      });

      const documents = rows.map((doc) => ({
        id: doc.id,
        name: doc.originalName,
        size: this.formatFileSize(doc.fileSize),
        uploadedAt: doc.createdAt,
        type: doc.fileType,
        status: doc.status,
        serviceRequestId: doc.serviceRequestId,
        consultationStatus: doc.serviceRequest?.status,
        mimeType: doc.mimeType,
        downloadCount: doc.downloadCount,
      }));

      return {
        data: documents,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting user documents:", error);
      throw error;
    }
  }

  /**
   * Clear document related cache
   */
  async clearDocumentCache(serviceRequestId) {
    // No-op - cache removed
  }

  async clearUserDocumentsCache(userId) {
    // No-op - cache removed
  }
  /*
   * Get multer upload middleware
   */
  getUploadMiddleware() {
    return upload.single("document");
  }

  /**
   * Get multiple files upload middleware
   */
  getMultipleUploadMiddleware() {
    return upload.array("documents", 10); // Max 10 files
  }

  /**
   * Upload profile image from Base64 to S3
   */
  async uploadProfileImage(base64Data, userId, userType) {
    try {
      // Check if it's already a URL (to avoid re-uploading if already on S3)
      if (
        typeof base64Data === "string" &&
        (base64Data.startsWith("http") || base64Data.startsWith("https"))
      ) {
        return base64Data;
      }

      // Base64 format: data:image/[type];base64,[data]
      const matches = base64Data.match(
        /^data:image\/([a-zA-Z+]+);base64,(.+)$/,
      );
      if (!matches || matches.length !== 3) {
        throw new Error("Invalid base64 image data");
      }

      const fileExtension = matches[1];
      const imageBuffer = Buffer.from(matches[2], "base64");
      const contentType = `image/${fileExtension}`;

      // Generate unique filename in profile_images folder
      const fileName = `profile_images/${userType}/${userId}_${Date.now()}.${fileExtension}`;

      // Upload to S3
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: imageBuffer,
        ContentType: contentType,
      };

      await s3.upload(uploadParams).promise();

      // Return the proxy URL instead of direct S3 URL
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
      logger.info("Profile image uploaded successfully", {
        userType,
        userId,
        fileName,
        backendUrl,
      });
      return `${backendUrl}/api/documents/profile-image/${userType}/${fileName.split("/").pop()}`;
    } catch (error) {
      logger.error("Error uploading profile image:", error);
      throw error;
    }
  }

  /**
   * Get profile image stream from S3
   */
  getProfileImageStream(key) {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
      };
      return s3.getObject(params).createReadStream();
    } catch (error) {
      logger.error("Error creating S3 read stream:", error);
      throw error;
    }
  }
}

module.exports = new DocumentService();
