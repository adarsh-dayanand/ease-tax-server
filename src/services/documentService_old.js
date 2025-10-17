const { Document, User, ServiceRequest } = require('../../models');
const cacheService = require('./cacheService');
const logger = require('../config/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class DocumentService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    this.setupUploadDirectory();
  }

  /**
   * Setup upload directory
   */
  async setupUploadDirectory() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'documents'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'temp'), { recursive: true });
    } catch (error) {
      logger.error('Error setting up upload directory:', error);
    }
  }

  /**
   * Configure multer for file uploads
   */
  getUploadMiddleware() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, path.join(this.uploadDir, 'temp'));
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      }
    });

    const fileFilter = (req, file, cb) => {
      if (this.allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, images, and Office documents are allowed.'));
      }
    };

    return multer({
      storage,
      limits: {
        fileSize: this.maxFileSize
      },
      fileFilter
    });
  }

  /**
   * Upload document
   */
  async uploadDocument(userId, file, documentType, serviceRequestId = null) {
    try {
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }

      if (!this.allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type');
      }

      // Generate secure filename
      const fileHash = crypto.createHash('md5').update(file.buffer || file.filename).digest('hex');
      const ext = path.extname(file.originalname);
      const secureFilename = `${fileHash}-${Date.now()}${ext}`;
      const finalPath = path.join(this.uploadDir, 'documents', secureFilename);

      // Move file from temp to documents directory
      if (file.path) {
        await fs.rename(file.path, finalPath);
      } else {
        await fs.writeFile(finalPath, file.buffer);
      }

      // Get file stats
      const stats = await fs.stat(finalPath);

      // Create document record
      const document = await Document.create({
        name: file.originalname,
        filename: secureFilename,
        path: finalPath,
        url: `/api/documents/${secureFilename}/download`,
        size: stats.size,
        type: file.mimetype,
        documentType,
        uploaderId: userId,
        serviceRequestId,
        status: 'uploaded'
      });

      // Clear related caches if service request is provided
      if (serviceRequestId) {
        const cacheKey = cacheService.getCacheKeys().CONSULTATION_DOCUMENTS(serviceRequestId);
        await cacheService.del(cacheKey);
      }

      return {
        id: document.id,
        name: document.name,
        size: this.formatFileSize(document.size),
        uploadedAt: document.createdAt,
        type: this.getFileTypeDisplay(document.type),
        url: document.url,
        status: document.status
      };
    } catch (error) {
      // Clean up temp file if upload failed
      if (file && file.path) {
        try {
          await fs.unlink(file.path);
        } catch (cleanupError) {
          logger.error('Error cleaning up temp file:', cleanupError);
        }
      }
      
      logger.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Upload document to consultation
   */
  async uploadConsultationDocument(consultationId, userId, file, documentType) {
    try {
      // Verify user has access to consultation
      const consultation = await ServiceRequest.findByPk(consultationId);
      
      if (!consultation) {
        throw new Error('Consultation not found');
      }

      if (consultation.userId !== userId && consultation.caId !== userId) {
        throw new Error('Access denied');
      }

      return await this.uploadDocument(userId, file, documentType, consultationId);
    } catch (error) {
      logger.error('Error uploading consultation document:', error);
      throw error;
    }
  }

  /**
   * Get document details
   */
  async getDocumentDetails(documentId, userId) {
    try {
      const document = await Document.findByPk(documentId, {
        include: [
          {
            model: User,
            as: 'uploader',
            attributes: ['id', 'name', 'role']
          },
          {
            model: ServiceRequest,
            as: 'serviceRequest',
            attributes: ['id', 'userId', 'caId']
          }
        ]
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permissions
      const hasAccess = this.checkDocumentAccess(document, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      return {
        id: document.id,
        name: document.name,
        size: this.formatFileSize(document.size),
        uploadedAt: document.createdAt,
        type: this.getFileTypeDisplay(document.type),
        documentType: document.documentType,
        uploader: document.uploader?.name,
        uploaderRole: document.uploader?.role,
        status: document.status,
        serviceRequestId: document.serviceRequestId
      };
    } catch (error) {
      logger.error('Error getting document details:', error);
      throw error;
    }
  }

  /**
   * Download document
   */
  async downloadDocument(documentId, userId) {
    try {
      const document = await Document.findByPk(documentId, {
        include: [
          {
            model: ServiceRequest,
            as: 'serviceRequest',
            attributes: ['id', 'userId', 'caId']
          }
        ]
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permissions
      const hasAccess = this.checkDocumentAccess(document, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      // Check if file exists
      try {
        await fs.access(document.path);
      } catch (error) {
        throw new Error('File not found on server');
      }

      // Update download count
      await document.increment('downloadCount');

      return {
        path: document.path,
        filename: document.name,
        mimetype: document.type
      };
    } catch (error) {
      logger.error('Error downloading document:', error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId, userId) {
    try {
      const document = await Document.findByPk(documentId, {
        include: [
          {
            model: ServiceRequest,
            as: 'serviceRequest',
            attributes: ['id', 'userId', 'caId']
          }
        ]
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Check if user can delete (only uploader or admin)
      if (document.uploaderId !== userId && req.user?.role !== 'admin') {
        throw new Error('Access denied');
      }

      // Delete file from filesystem
      try {
        await fs.unlink(document.path);
      } catch (error) {
        logger.warn('File not found on filesystem:', error);
      }

      // Delete database record
      await document.destroy();

      // Clear related caches
      if (document.serviceRequestId) {
        const cacheKey = cacheService.getCacheKeys().CONSULTATION_DOCUMENTS(document.serviceRequestId);
        await cacheService.del(cacheKey);
      }

      return true;
    } catch (error) {
      logger.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Get document status
   */
  async getDocumentStatus(documentId, userId) {
    try {
      const document = await Document.findByPk(documentId, {
        attributes: ['id', 'status', 'processingInfo', 'uploaderId'],
        include: [
          {
            model: ServiceRequest,
            as: 'serviceRequest',
            attributes: ['id', 'userId', 'caId']
          }
        ]
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permissions
      const hasAccess = this.checkDocumentAccess(document, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      return {
        id: document.id,
        status: document.status,
        processingInfo: document.processingInfo || null
      };
    } catch (error) {
      logger.error('Error getting document status:', error);
      throw error;
    }
  }

  /**
   * Get user documents
   */
  async getUserDocuments(userId, page = 1, limit = 10, documentType = null) {
    try {
      const offset = (page - 1) * limit;
      const whereClause = { uploaderId: userId };
      
      if (documentType) {
        whereClause.documentType = documentType;
      }

      const { rows, count } = await Document.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: ServiceRequest,
            as: 'serviceRequest',
            attributes: ['id', 'status']
          }
        ]
      });

      const documents = rows.map(doc => ({
        id: doc.id,
        name: doc.name,
        size: this.formatFileSize(doc.size),
        uploadedAt: doc.createdAt,
        type: this.getFileTypeDisplay(doc.type),
        documentType: doc.documentType,
        status: doc.status,
        serviceRequestId: doc.serviceRequestId,
        consultationStatus: doc.serviceRequest?.status
      }));

      return {
        data: documents,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting user documents:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  checkDocumentAccess(document, userId) {
    // Admin has access to all documents
    if (req.user?.role === 'admin') return true;
    
    // Uploader has access
    if (document.uploaderId === userId) return true;
    
    // Users in the same consultation have access
    if (document.serviceRequest) {
      return document.serviceRequest.userId === userId || document.serviceRequest.caId === userId;
    }
    
    return false;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getFileTypeDisplay(mimeType) {
    const typeMap = {
      'application/pdf': 'PDF',
      'image/jpeg': 'JPEG',
      'image/png': 'PNG',
      'image/jpg': 'JPG',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX'
    };

    return typeMap[mimeType] || 'FILE';
  }
}

module.exports = new DocumentService();