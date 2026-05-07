const Joi = require("joi");
const { AppError } = require("../middlewares/errorMiddleware");

const applyRequestInputSchema = Joi.object({
    applicant_id: Joi.string().uuid().required(),
    unit_id: Joi.string().uuid().required(),
    service_type: Joi.string()
        .valid("MINING", "POLLUTION", "FOREST_CUTTING", "FOREST_TRANSIT")
        .required(),
    form_data: Joi.object().required().messages({
        "object.base": "Form data must be a valid JSON object.",
    }),
    attachments: Joi.object().optional(),
    payment_receipt_path: Joi.string().optional(),
});

module.exports = {
    applyRequestInputSchema,
};
