const AWS = require("aws-sdk");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { Document } = require("../../models");
const cacheService = require("./cacheService");
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
        `File type .${fileExtension} not allowed. Allowed types: ${allowedTypes.join(", ")}`
      ),
      false
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
  /**
   * Upload document to S3
   */
  async uploadDocument(
    file,
    serviceRequestId,
    uploadedBy,
    uploaderType,
    fileType
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

      // Clear cache
      await this.clearDocumentCache(serviceRequestId);

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
        "itr_v"
      );
    } catch (error) {
      logger.error("Error uploading ITR-V document:", error);
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
        }
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
          (p) => p.paymentType === "service_fee" && p.status === "completed"
        );

        if (!finalPayment) {
          throw new Error(
            "ITR-V download requires completion of final payment"
          );
        }
      }

      // If user is the CA, they can only access documents AFTER escrow payment is made
      if (serviceRequest.caId === userId) {
        const hasEscrowPayment = serviceRequest.payments?.some(
          (p) => p.paymentType === "booking_fee" && p.status === "completed"
        );

        if (!hasEscrowPayment) {
          throw new Error(
            "Access denied - escrow payment required for CA to access documents"
          );
        }
      }

      // Generate presigned URL for secure download
      const downloadParams = {
        Bucket: BUCKET_NAME,
        Key: document.metadata.s3Key,
        Expires: 3600, // URL expires in 1 hour
        ResponseContentDisposition: `attachment; filename="${document.originalName}"`,
      };

      const downloadUrl = s3.getSignedUrl("getObject", downloadParams);

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
            "Access denied - escrow payment required for CA to access documents"
          );
        }
      }

      const cacheKey = cacheService
        .getCacheKeys()
        .CONSULTATION_DOCUMENTS(serviceRequestId);

      let documents = await cacheService.get(cacheKey);

      if (!documents) {
        const docs = await Document.findAll({
          where: {
            serviceRequestId,
            status: { [require("sequelize").Op.ne]: "deleted" },
          },
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: require("../../models").User,
              as: "uploaderUser",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: require("../../models").CA,
              as: "uploaderCA",
              attributes: ["id", "name"],
              required: false,
            },
          ],
        });

        documents = docs.map((doc) => ({
          id: doc.id,
          name: doc.originalName,
          size: this.formatFileSize(doc.fileSize),
          uploadedAt: this.formatTimestamp(doc.createdAt),
          type: doc.fileType,
          status: doc.status,
          uploader: doc.uploaderType,
          uploaderName:
            doc.uploaderUser?.name || doc.uploaderCA?.name || "Unknown",
          mimeType: doc.mimeType,
          downloadCount: doc.downloadCount,
        }));

        // Cache for 30 minutes
        await cacheService.set(cacheKey, documents, 1800);
      }

      return documents;
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

      // Check if user is the uploader
      if (document.uploadedBy !== userId) {
        throw new Error("Access denied - only uploader can delete document");
      }

      // Delete from S3
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Key: document.metadata.s3Key,
      };

      await s3.deleteObject(deleteParams).promise();

      // Mark as deleted in database (soft delete)
      await document.update({
        status: "deleted",
        deletedAt: new Date(),
      });

      // Clear cache
      await this.clearDocumentCache(document.serviceRequestId);

      return { success: true, message: "Document deleted successfully" };
    } catch (error) {
      logger.error("Error deleting document:", error);
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
        document.serviceRequestId
      );

      if (!serviceRequest || serviceRequest.caId !== caId) {
        throw new Error(
          "Access denied - only assigned CA can verify documents"
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

      // Clear cache
      await this.clearDocumentCache(document.serviceRequestId);

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
   * Clear document related cache
   */
  async clearDocumentCache(serviceRequestId) {
    try {
      const cacheKey = cacheService
        .getCacheKeys()
        .CONSULTATION_DOCUMENTS(serviceRequestId);
      await cacheService.del(cacheKey);
    } catch (error) {
      logger.error("Error clearing document cache:", error);
    }
  }

  /**
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
}

module.exports = new DocumentService();
