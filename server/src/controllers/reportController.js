const path = require('path');
const fs = require('fs');
const multer = require('multer');
const CitizenReport = require('../models/CitizenReport');
const Project = require('../models/Project');
const Department = require('../models/Department');
const env = require('../config/env');
const { ApiError, asyncHandler } = require('../utils/errors');
const { writeAudit } = require('../services/auditService');

/* ---------- Image upload (optional evidence photos) ----------
 * Images go to local disk by default (served from /uploads). If
 * CLOUDINARY_URL is configured they are pushed to Cloudinary instead and the
 * local copy is removed. Max 5 MB, images only.
 */
const uploadDir = path.resolve(process.cwd(), env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `report-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpe?g|png|gif|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest('Only JPG, PNG, GIF or WebP images are allowed.'));
  },
});

/**
 * Ownership guard that runs BEFORE multer touches disk, so unauthorised
 * uploads never leave orphan files in the uploads directory.
 */
exports.requireReportUploader = asyncHandler(async (req, _res, next) => {
  const report = await CitizenReport.findById(req.params.id).select('citizenId');
  if (!report) throw ApiError.notFound('Report not found.');
  const isOwner = String(report.citizenId) === String(req.user._id);
  const isOfficial = ['official', 'administrator'].includes(req.user.role);
  if (!isOwner && !isOfficial) throw ApiError.forbidden('You can only add photos to your own reports.');
  next();
});

/** Multipart middleware for POST /reports/:id/images (field name: "image"). */
exports.uploadReportImage = imageUpload.single('image');

const REPORT_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected'];

/** Shape a report for officials: citizen name only, never email. */
function reportDtoForOfficials(r) {
  return {
    ...r,
    citizen: r.citizenId ? { _id: r.citizenId._id, name: r.citizenId.name } : null,
    assignedDepartment: r.assignedDepartmentId,
    linkedProject: r.linkedProjectId ? { _id: r.linkedProjectId._id, title: r.linkedProjectId.title, location: r.linkedProjectId.location } : null,
  };
}

/** Shape a report for its owner: everything except internal department ids. */
function reportDtoForOwner(r) {
  return { ...r, assignedDepartment: r.assignedDepartmentId, linkedProject: r.linkedProjectId };
}

/**
 * POST /api/reports — any signed-in citizen.
 */
exports.createReport = asyncHandler(async (req, res) => {
  const { title, description, category, address, ward, roadSegmentId, projectId } = req.body || {};
  const errors = [];
  if (!title || String(title).trim().length < 5) errors.push({ field: 'title', message: 'Title must be at least 5 characters.' });
  if (!description || String(description).trim().length < 15) errors.push({ field: 'description', message: 'Describe the issue in at least 15 characters.' });
  if (!address || !String(address).trim()) errors.push({ field: 'address', message: 'A location/landmark is required.' });
  if (!category) errors.push({ field: 'category', message: 'Choose a category.' });
  if (errors.length) throw ApiError.badRequest('Please fix the highlighted fields.', errors);

  let linkedProjectId = null;
  if (projectId) {
    const project = await Project.findById(projectId).select('_id title');
    if (!project) throw ApiError.badRequest('The linked project does not exist.');
    linkedProjectId = project._id;
  }

  const report = await CitizenReport.create({
    title: String(title).trim(),
    description: String(description).trim(),
    category,
    location: { address: String(address).trim(), ward: String(ward || '').trim() },
    roadSegmentId: String(roadSegmentId || '').trim(),
    citizenId: req.user._id,
    linkedProjectId,
    statusHistory: [{ status: 'submitted', changedBy: req.user._id, at: new Date() }],
  });

  await writeAudit({
    actor: req.user,
    entityType: 'report',
    entityId: report._id,
    action: 'report.submitted',
    newValues: { category: report.category, title: report.title },
  });

  res.status(201).json({ report: reportDtoForOwner(report.toObject()) });
});

/** GET /api/reports/mine — the citizen's own reports. */
exports.myReports = asyncHandler(async (req, res) => {
  const items = await CitizenReport.find({ citizenId: req.user._id })
    .sort({ createdAt: -1 })
    .populate('assignedDepartmentId', 'name departmentType')
    .populate('linkedProjectId', 'title status')
    .lean();
  res.json({ items: items.map(reportDtoForOwner), total: items.length });
});

/**
 * GET /api/reports — officials/admins only.
 * Privacy: the citizen's name is included for handling, but never their email,
 * and other officials cannot see contact details.
 */
exports.listReports = asyncHandler(async (req, res) => {
  const { status, category, departmentId } = req.query;
  const filter = {};
  if (status) filter.status = { $in: String(status).split(',') };
  if (category) filter.category = category;
  if (departmentId) filter.assignedDepartmentId = departmentId;

  const items = await CitizenReport.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('citizenId', 'name')
    .populate('assignedDepartmentId', 'name departmentType')
    .populate('linkedProjectId', 'title status location')
    .lean();

  res.json({ items: items.map(reportDtoForOfficials), total: items.length });
});

/** GET /api/reports/:id — owner or official. */
exports.getReport = asyncHandler(async (req, res) => {
  const report = await CitizenReport.findById(req.params.id)
    .populate('assignedDepartmentId', 'name departmentType')
    .populate('linkedProjectId', 'title status')
    .lean();
  if (!report) throw ApiError.notFound('Report not found.');

  const isOwner = String(report.citizenId) === String(req.user._id);
  const isOfficial = ['official', 'administrator'].includes(req.user.role);
  if (!isOwner && !isOfficial) throw ApiError.forbidden('You can only view your own reports.');

  // Owners never get other citizens' data; officials get the name only.
  if (isOwner) return res.json({ report: reportDtoForOwner(report) });
  const citizen = await require('../models/User').findById(report.citizenId).select('name').lean();
  res.json({ report: { ...reportDtoForOfficials(report), citizen } });
});

/** PATCH /api/reports/:id/status — officials only. */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, note, assignedDepartmentId, linkedProjectId } = req.body || {};
  if (!REPORT_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status.');

  const report = await CitizenReport.findById(req.params.id);
  if (!report) throw ApiError.notFound('Report not found.');
  if (['resolved', 'rejected'].includes(status) && !note) {
    throw ApiError.badRequest('A note explaining the outcome is required for resolved/rejected reports.');
  }

  const previousStatus = report.status;
  report.status = status;
  if (assignedDepartmentId) {
    const dept = await Department.findById(assignedDepartmentId).select('_id');
    if (!dept) throw ApiError.badRequest('That department does not exist.');
    report.assignedDepartmentId = dept._id;
  }
  if (linkedProjectId) {
    const project = await Project.findById(linkedProjectId).select('_id');
    if (!project) throw ApiError.badRequest('That project does not exist.');
    report.linkedProjectId = project._id;
  }
  report.statusHistory = [...(report.statusHistory || []), { status, changedBy: req.user._id, note: String(note || '').slice(0, 500), at: new Date() }];
  await report.save();

  await writeAudit({
    actor: req.user,
    entityType: 'report',
    entityId: report._id,
    action: 'report.status_changed',
    previousValues: { status: previousStatus },
    newValues: { status },
    explanation: String(note || ''),
  });

  const populated = await CitizenReport.findById(report._id)
    .populate('citizenId', 'name')
    .populate('assignedDepartmentId', 'name')
    .populate('linkedProjectId', 'title status')
    .lean();
  res.json({ report: reportDtoForOfficials(populated) });
});

/** PATCH /api/reports/:id/response — officials only. */
exports.updateResponse = asyncHandler(async (req, res) => {
  const { officialResponse, resolutionNotes } = req.body || {};
  const report = await CitizenReport.findById(req.params.id);
  if (!report) throw ApiError.notFound('Report not found.');

  report.officialResponse = String(officialResponse || '').trim().slice(0, 3000);
  if (resolutionNotes !== undefined) report.resolutionNotes = String(resolutionNotes || '').trim().slice(0, 2000);
  await report.save();

  await writeAudit({
    actor: req.user,
    entityType: 'report',
    entityId: report._id,
    action: 'report.responded',
    explanation: report.officialResponse.slice(0, 200),
  });

  const populated = await CitizenReport.findById(report._id)
    .populate('citizenId', 'name')
    .populate('assignedDepartmentId', 'name')
    .populate('linkedProjectId', 'title')
    .lean();
  res.json({ report: reportDtoForOfficials(populated) });
});

/** POST /api/reports/:id/images — owner or official attaches a photo. */
exports.addImage = asyncHandler(async (req, res) => {
  const report = await CitizenReport.findById(req.params.id);
  if (!report) throw ApiError.notFound('Report not found.');

  const isOwner = String(report.citizenId) === String(req.user._id);
  if (!req.file) throw ApiError.badRequest('No image received. Send the file as multipart form field "image".');

  let url = `/uploads/${req.file.filename}`;
  if (env.cloudinaryUrl) {
    // Cloudinary configured → upload the stored file, then drop the local copy.
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({ cloudinary_url: env.cloudinaryUrl });
    const result = await cloudinary.uploader.upload(req.file.path, { folder: 'civictrack/reports' });
    url = result.secure_url;
    fs.unlink(req.file.path, () => {});
  }

  report.images = [
    ...(report.images || []),
    { url, caption: String(req.body?.caption || '').trim().slice(0, 300), uploadedAt: new Date() },
  ];
  await report.save();

  await writeAudit({
    actor: req.user,
    entityType: 'report',
    entityId: report._id,
    action: 'report.image_added',
    newValues: { imageCount: report.images.length },
    explanation: isOwner ? 'Photo attached by the citizen.' : 'Photo attached by an official.',
  });

  res.status(201).json({ report: reportDtoForOwner(report.toObject()) });
});
