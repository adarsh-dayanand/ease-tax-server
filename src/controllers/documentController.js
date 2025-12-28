const documentService = require("../services/documentService");
const logger = require("../config/logger");

class DocumentController {
  /**
   * Upload document
   * POST /documents/upload
   */
  async uploadDocument(req, res) {
    try {
      const userId = req.user.id;
      const { documentType, serviceRequestId } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      if (!documentType) {
        return res.status(400).json({
          success: false,
          message: "Document type is required",
        });
      }

      const document = await documentService.uploadDocument(
        userId,
        req.file,
        documentType,
        serviceRequestId
      );

      res.status(201).json({
        success: true,
        data: document,
        message: "Document uploaded successfully",
      });
    } catch (error) {
      logger.error("Error in uploadDocument:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to upload document",
      });
    }
  }

  /**
   * Upload document to consultation
   * POST /consultations/:consultationId/documents
   */
  async uploadConsultationDocument(req, res) {
    try {
      const { consultationId } = req.params;
      const userId = req.user.id;
      const { documentType } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      if (!documentType) {
        return res.status(400).json({
          success: false,
          message: "Document type is required",
        });
      }

      const document = await documentService.uploadConsultationDocument(
        consultationId,
        userId,
        req.file,
        documentType
      );

      res.status(201).json({
        success: true,
        data: document,
        message: "Document uploaded to consultation successfully",
      });
    } catch (error) {
      logger.error("Error in uploadConsultationDocument:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to upload document",
      });
    }
  }

  /**
   * Get document details
   * GET /documents/:docId
   */
  async getDocumentDetails(req, res) {
    try {
      const { docId } = req.params;
      const userId = req.user.id;

      const document = await documentService.getDocumentDetails(docId, userId);

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      logger.error("Error in getDocumentDetails:", error);

      if (error.message === "Document not found") {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      if (error.message === "Access denied") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Download document
   * GET /documents/:docId/download
   */
  async downloadDocument(req, res) {
    try {
      const { docId, consultationId } = req.params;
      const userId = req.user.id;

      // If consultationId is provided, validate that the document belongs to this consultation
      if (consultationId) {
        const Document = require("../../models").Document;
        const document = await Document.findByPk(docId);
        
        if (!document) {
          return res.status(404).json({
            success: false,
            message: "Document not found",
          });
        }

        // Verify document belongs to the specified consultation/service request
        if (document.serviceRequestId !== consultationId) {
          return res.status(403).json({
            success: false,
            message: "Document does not belong to this consultation",
          });
        }
      }

      const fileInfo = await documentService.downloadDocument(docId, userId);

      logger.info("Document download initiated", {
        docId,
        userId,
        hasDownloadUrl: !!fileInfo.downloadUrl,
        filename: fileInfo.filename,
      });

      // If downloadUrl is provided (S3 presigned URL)
      if (fileInfo.downloadUrl) {
        // Check if client wants JSON response (for frontend to handle download)
        const acceptHeader = req.headers.accept || "";
        const wantsJson = acceptHeader.includes("application/json") || req.query.format === "json";

        if (wantsJson) {
          // Return URL as JSON for frontend to handle
          return res.json({
            success: true,
            data: {
              downloadUrl: fileInfo.downloadUrl,
              filename: fileInfo.filename,
              fileSize: fileInfo.fileSize,
              contentType: fileInfo.contentType,
            },
          });
        } else {
          // Redirect to presigned URL (browser will handle download)
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
          return res.redirect(fileInfo.downloadUrl);
        }
      }

      // Otherwise, send file directly (for local storage)
      if (fileInfo.path) {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`
        );
        res.setHeader("Content-Type", fileInfo.contentType || fileInfo.mimetype || "application/octet-stream");
        return res.sendFile(fileInfo.path, { root: "." });
      }

      // Return file info as JSON if neither URL nor path is available
      // This allows frontend to handle the download
      return res.json({
        success: true,
        data: fileInfo,
      });
    } catch (error) {
      logger.error("Error in downloadDocument:", error);

      if (
        error.message === "Document not found" ||
        error.message === "File not found on server" ||
        error.message === "Document has been deleted"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message || "Document not found",
        });
      }

      if (
        error.message === "Access denied" ||
        error.message.includes("Access denied")
      ) {
        return res.status(403).json({
          success: false,
          message: error.message || "Access denied",
        });
      }

      if (
        error.message === "Document storage information not found" ||
        error.message === "Failed to generate download URL"
      ) {
        return res.status(500).json({
          success: false,
          message: error.message || "Failed to prepare document for download",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        ...(process.env.NODE_ENV === "development" && {
          error: error.message,
        }),
      });
    }
  }

  /**
   * Delete document
   * DELETE /consultations/:consultationId/documents/:docId
   */
  async deleteDocument(req, res) {
    try {
      const { docId, consultationId } = req.params;
      const userId = req.user.id;
      const userType = req.user.type;

      logger.info("Delete document request", {
        docId,
        consultationId,
        userId,
        userType,
      });

      // If consultationId is provided, validate that the document belongs to this consultation
      if (consultationId) {
        const Document = require("../../models").Document;
        const document = await Document.findByPk(docId);
        
        if (!document) {
          return res.status(404).json({
            success: false,
            message: "Document not found",
          });
        }

        // Verify document belongs to the specified consultation/service request
        if (document.serviceRequestId !== consultationId) {
          return res.status(403).json({
            success: false,
            message: "Document does not belong to this consultation",
          });
        }
      }

      await documentService.deleteDocument(docId, userId);

      logger.info("Document deleted successfully", {
        docId,
        userId,
      });

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      logger.error("Error in deleteDocument:", {
        error: error.message,
        stack: error.stack,
        docId: req.params.docId,
        userId: req.user?.id,
      });

      if (
        error.message === "Document not found" ||
        error.message === "Service request not found"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message || "Document not found",
        });
      }

      if (
        error.message === "Access denied" ||
        error.message.includes("Access denied") ||
        error.message.includes("permission")
      ) {
        return res.status(403).json({
          success: false,
          message: error.message || "Access denied",
        });
      }

      if (error.message === "Document has already been deleted") {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        ...(process.env.NODE_ENV === "development" && {
          error: error.message,
        }),
      });
    }
  }

  /**
   * Get document status
   * GET /documents/:docId/status
   */
  async getDocumentStatus(req, res) {
    try {
      const { docId } = req.params;
      const userId = req.user.id;

      const status = await documentService.getDocumentStatus(docId, userId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error("Error in getDocumentStatus:", error);

      if (error.message === "Document not found") {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      if (error.message === "Access denied") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get user documents
   * GET /users/:userId/documents
   */
  async getUserDocuments(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10, documentType } = req.query;

      // Check user access
      if (req.user.id !== userId && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const result = await documentService.getUserDocuments(
        userId,
        parseInt(page),
        parseInt(limit),
        documentType
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error("Error in getUserDocuments:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get document types
   * GET /documents/types
   */
  async getDocumentTypes(req, res) {
    try {
      const documentTypes = [
        {
          id: "form16",
          name: "Form 16",
          description: "Salary certificate issued by employer",
        },
        {
          id: "pancard",
          name: "PAN Card",
          description: "Permanent Account Number card",
        },
        {
          id: "aadhar",
          name: "Aadhar Card",
          description: "Unique identification card",
        },
        {
          id: "bankstatement",
          name: "Bank Statement",
          description: "Bank account statement",
        },
        {
          id: "salaryslip",
          name: "Salary Slip",
          description: "Monthly salary slip",
        },
        {
          id: "investmentproof",
          name: "Investment Proof",
          description: "Investment documents for tax saving",
        },
        {
          id: "houserent",
          name: "House Rent",
          description: "House rent receipts",
        },
        {
          id: "medicalbill",
          name: "Medical Bills",
          description: "Medical treatment bills",
        },
        {
          id: "donation",
          name: "Donation Receipt",
          description: "Charitable donation receipts",
        },
        {
          id: "other",
          name: "Other",
          description: "Other supporting documents",
        },
      ];

      res.json({
        success: true,
        data: documentTypes,
      });
    } catch (error) {
      logger.error("Error in getDocumentTypes:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get upload guidelines
   * GET /documents/guidelines
   */
  async getUploadGuidelines(req, res) {
    try {
      const guidelines = {
        maxFileSize: "10 MB",
        allowedFormats: ["PDF", "JPEG", "PNG", "DOC", "DOCX", "XLS", "XLSX"],
        recommendations: [
          "Upload clear, high-resolution images",
          "Ensure all text is readable",
          "Use PDF format for official documents",
          "Compress large files before uploading",
          "Name files descriptively",
        ],
        requiredDocuments: [
          "Form 16 (mandatory for salaried individuals)",
          "PAN Card copy",
          "Bank statement for the financial year",
          "Investment proofs (80C, 80D, etc.)",
        ],
      };

      res.json({
        success: true,
        data: guidelines,
      });
    } catch (error) {
      logger.error("Error in getUploadGuidelines:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new DocumentController();
