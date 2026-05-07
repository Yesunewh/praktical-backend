const { applyRequestService, getMyRequestsService, getRequestByIdService, getStaffRequestsService, assignRequestService, transitionRequestService, resubmitRequestService, assessRequestService, signRequestService, getMyTasksService } = require("../services/requestService");
const { applyRequestInputSchema } = require("../validators/requestValidators");
const fs = require("fs");
const { AppError } = require("../middlewares/errorMiddleware");

const applyRequestController = async (req, res, next) => {
    try {
        let payload = { ...req.body };

        // Parse form_data string if uploaded via multipart/form-data
        if (typeof payload.form_data === "string") {
            try {
                payload.form_data = JSON.parse(payload.form_data);
            } catch (e) {
                throw new AppError("form_data must be a valid JSON string", 400);
            }
        }

        // Validate manually so we retain try/catch control
        const { error } = applyRequestInputSchema.validate(payload);
        if (error) {
            throw new AppError(error.details[0].message, 400);
        }

        // Organize Attachments from req.files
        const attachments = {};
        if (req.files && req.files.length > 0) {
            req.files.forEach((file) => {
                attachments[file.fieldname] = `/uploads/${file.filename}`;
            });
        }
        payload.attachments = attachments;

        const newRequest = await applyRequestService(payload);

        res.status(201).json({
            success: true,
            message: req.t ? req.t("success.request_submitted") : "Application submitted successfully",
            data: newRequest,
        });
    } catch (error) {
        // Delete files instantly if ANYTHING failed (validation or db save)
        if (req.files && req.files.length > 0) {
            req.files.forEach((file) => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        next(error);
    }
};

const getMyRequestsController = async (req, res, next) => {
    try {
        const applicant_id = req.query.applicant_id;
        if (!applicant_id) {
            throw new AppError("applicant_id query parameter is required.", 400);
        }

        const requests = await getMyRequestsService(applicant_id);

        res.status(200).json({
            success: true,
            data: requests,
        });
    } catch (error) {
        next(error);
    }
};

const getRequestByIdController = async (req, res, next) => {
    try {

        const requestId = req.params.id;
        const request = await getRequestByIdService(requestId);

        res.status(200).json({
            success: true,
            data: request,
        });
    } catch (error) {
        next(error);
    }
};

const getStaffRequestsController = async (req, res, next) => {
    try {
        const statusFilter = req.query.status;
        const unit_id = req.user.unit.id;
        const user_level = req.user.unit.level;
        const mapped_specialization = req.user.unit.specialization;
        const parent_id = req.user.unit.parent_id;

        const requests = await getStaffRequestsService(unit_id, statusFilter, user_level, mapped_specialization, parent_id);

        res.status(200).json({
            success: true,
            data: requests,
        });
    } catch (error) {
        next(error);
    }
};

const assignRequestController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { assigned_pro_ids } = req.body;
        const result = await assignRequestService(id, assigned_pro_ids, req.user);
        res.status(200).json({ success: true, message: req.t ? req.t("success.request_assigned") : "Request assigned successfully", data: result });
    } catch (error) {
        next(error);
    }
};

const transitionRequestController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, comment } = req.body;
        const result = await transitionRequestService(id, action, comment, req.user);
        res.status(200).json({ success: true, message: req.t ? req.t("success.request_transitioned") : "Request status transitioned successfully", data: result });
    } catch (error) {
        next(error);
    }
};

const resubmitRequestController = async (req, res, next) => {
    try {
        const { id } = req.params;
        let payload = { ...req.body };

        if (typeof payload.form_data === "string") {
            try {
                payload.form_data = JSON.parse(payload.form_data);
            } catch (e) {
                throw new AppError("form_data must be a valid JSON string", 400);
            }
        }

        let newAttachments = {};
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                newAttachments[file.fieldname] = file.path;
            });
        }

        const result = await resubmitRequestService(id, payload.form_data || {}, newAttachments, req.user);
        res.status(200).json({ success: true, message: req.t ? req.t("success.request_resubmitted") : "Request resubmitted successfully", data: result });
    } catch (error) {
        next(error);
    }
};

const assessRequestController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { assessments_data, fee_amount } = req.body;
        const result = await assessRequestService(id, assessments_data, fee_amount, req.user);
        res.status(200).json({ success: true, message: req.t ? req.t("success.request_assessed") : "Field Assessment registered correctly.", data: result });
    } catch (error) {
        next(error);
    }
};

const signRequestController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await signRequestService(id, req.user);
        res.status(200).json({ success: true, message: req.t ? req.t("success.request_signed") : "Assessment Document officially digitally co-signed.", data: result });
    } catch (error) {
        next(error);
    }
};

const getMyTasksController = async (req, res, next) => {
    try {
        const { status } = req.query;
        const result = await getMyTasksService(req.user, status);
        res.status(200).json({ success: true, count: result.length, data: result });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    applyRequestController,
    getMyRequestsController,
    getRequestByIdController,
    getStaffRequestsController,
    assignRequestController,
    transitionRequestController,
    resubmitRequestController,
    assessRequestController,
    signRequestController,
    getMyTasksController,
};
