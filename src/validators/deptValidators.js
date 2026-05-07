const Joi = require("joi");

const deptSchema = Joi.object({
  name: Joi.string().max(255).required().messages({
    "string.empty": "Department name is required.",
    "string.max": "Department name must be less than or equal to 255 characters.",
  }),
  org_id: Joi.string().guid({ version: 'uuidv4' }).optional().messages({
    "string.guid": "Invalid Organization ID.",
  }),
  description: Joi.string().allow("").optional(),
  status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
});

const validateDept = (req, res, next) => {
  const { error } = deptSchema.validate(req.body);
  if (error) {
    const detail = error.details[0];
    let message = detail.message;

    if (req.t) {
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

const deptPatchSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  description: Joi.string().allow("", null).optional(),
  status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
  unit_id: Joi.string().guid({ version: "uuidv4" }).allow(null, "").optional(),
}).min(1);

const validateDeptPatch = (req, res, next) => {
  const { error } = deptPatchSchema.validate(req.body);
  if (error) {
    const detail = error.details[0];
    return res.status(400).json({ success: false, message: detail.message });
  }
  next();
};

module.exports = { validateDept, validateDeptPatch };
