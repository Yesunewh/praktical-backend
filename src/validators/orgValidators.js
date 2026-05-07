const Joi = require("joi");

const orgSchema = Joi.object({
  name: Joi.string().max(255).required().messages({
    "string.empty": "Organization name is required.",
    "string.max": "Organization name must be less than or equal to 255 characters.",
  }),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).required().messages({
    "string.empty": "Organization slug is required.",
    "string.pattern.base": "Slug must contain only lowercase letters, numbers, and hyphens.",
  }),
  status: Joi.string().valid("ACTIVE", "SUSPENDED", "PENDING").optional(),
  subscription_plan: Joi.string().valid("BASIC", "PREMIUM", "ENTERPRISE").optional(),
});

const validateOrg = (req, res, next) => {
  const { error } = orgSchema.validate(req.body);
  if (error) {
    const detail = error.details[0];
    let message = detail.message;

    if (req.t) {
      // Translation logic similar to userValidators
      const fieldKey = detail.context.label || detail.path[0];
      const field = req.t(`fields.${fieldKey}`);
      
      if (detail.type === "any.required" || detail.type === "string.empty") {
        message = req.t("errors.field_required").replace("{{field}}", field);
      }
    }

    return res.status(400).json({ success: false, message });
  }
  next();
};

module.exports = { validateOrg };
