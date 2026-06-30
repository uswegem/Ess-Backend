const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const AuditLog = require('../models/AuditLog');
const { getTenantById } = require('../services/tenantService');
const logger = require('../utils/logger');

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'tenants');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function isPemLike(buffer, label) {
  const text = buffer.toString('utf8');
  if (label === 'private') {
    return text.includes('BEGIN') && (text.includes('PRIVATE KEY') || text.includes('RSA PRIVATE KEY'));
  }
  return text.includes('BEGIN') && text.includes('CERTIFICATE');
}

function fingerprintFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

class TenantCertificateController {
  static async getCertificates(req, res) {
    try {
      const tenant = await getTenantById(req.params.tenantId);
      const certs = tenant.certificates || {};
      res.json({
        success: true,
        data: {
          hasCertificates: Boolean(certs.publicCertificatePath),
          certificateFingerprint: certs.certificateFingerprint || null,
          expiresAt: certs.expiresAt || null,
          uploadedAt: certs.uploadedAt || null,
          hasPrivateKey: Boolean(certs.privateKeyPath),
          hasCaCertificate: Boolean(certs.caCertificatePath)
        }
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async uploadCertificates(req, res) {
    try {
      const { tenantId } = req.params;
      const tenant = await getTenantById(tenantId);
      const publicCert = req.files?.publicCert?.[0];
      const privateKey = req.files?.privateKey?.[0];
      const caCert = req.files?.caCert?.[0];

      if (!publicCert || !privateKey) {
        return res.status(400).json({
          success: false,
          message: 'publicCert and privateKey files are required.'
        });
      }

      if (!isPemLike(publicCert.buffer, 'cert') || !isPemLike(privateKey.buffer, 'private')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid PEM certificate or private key format.'
        });
      }

      const certDir = path.join(UPLOAD_ROOT, tenantId, 'certs');
      ensureDir(certDir);

      const publicPath = path.join(certDir, 'public.pem');
      const privatePath = path.join(certDir, 'private.pem');
      const caPath = caCert ? path.join(certDir, 'ca.pem') : null;

      fs.writeFileSync(publicPath, publicCert.buffer, { mode: 0o644 });
      fs.writeFileSync(privatePath, privateKey.buffer, { mode: 0o600 });
      if (caCert && caPath) {
        fs.writeFileSync(caPath, caCert.buffer, { mode: 0o644 });
      }

      tenant.certificates = {
        publicCertificatePath: publicPath,
        privateKeyPath: privatePath,
        caCertificatePath: caPath,
        certificateFingerprint: fingerprintFile(publicPath),
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
        uploadedAt: new Date(),
        uploadedBy: req.user?._id
      };
      await tenant.save();

      try {
        await AuditLog.create({
          action: 'certificate_upload',
          description: `ESS signing certificates uploaded for tenant ${tenantId}`,
          tenantId,
          tenant: tenant._id,
          userId: req.user?._id,
          correlationId: req.correlationId,
          ipAddress: req.ip,
          status: 'success'
        });
      } catch (auditError) {
        logger.warn('Certificate upload audit log failed:', auditError.message);
      }

      res.json({
        success: true,
        message: 'Certificates uploaded successfully.',
        data: {
          certificateFingerprint: tenant.certificates.certificateFingerprint,
          uploadedAt: tenant.certificates.uploadedAt
        }
      });
    } catch (error) {
      logger.error('Certificate upload error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteCertificates(req, res) {
    try {
      const { tenantId } = req.params;
      const tenant = await getTenantById(tenantId);
      const certs = tenant.certificates || {};

      [certs.publicCertificatePath, certs.privateKeyPath, certs.caCertificatePath]
        .filter(Boolean)
        .forEach((filePath) => {
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch (e) {
            logger.warn('Failed to delete cert file:', e.message);
          }
        });

      tenant.certificates = undefined;
      await tenant.save();

      try {
        await AuditLog.create({
          action: 'certificate_delete',
          description: `ESS signing certificates removed for tenant ${tenantId}`,
          tenantId,
          tenant: tenant._id,
          userId: req.user?._id,
          correlationId: req.correlationId,
          ipAddress: req.ip,
          status: 'success'
        });
      } catch (auditError) {
        logger.warn('Certificate delete audit log failed:', auditError.message);
      }

      res.json({ success: true, message: 'Certificates removed.' });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = TenantCertificateController;
