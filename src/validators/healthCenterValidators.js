const Joi = require("joi");

// Define the healthCenter validation schema
const healthCenterSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "errors.health_center_name_required",
    "any.required": "errors.health_center_name_required",
  }),
});

// Define assign healthCenter admin validation schema
const assignHealthCenterAdminSchema = Joi.object({
  userId: Joi.string()
    .uuid()
    .required()
    .messages({
      "string.empty": "errors.user_id_required",
      "any.required": "errors.user_id_required",
      "string.guid": "errors.invalid_uuid",
    }),

  healthCenterId: Joi.string()
    .uuid()
    .required()
    .messages({
      "string.empty": "errors.health_center_id_required",
      "any.required": "errors.health_center_id_required",
      "string.guid": "errors.invalid_uuid",
    }),

  permissions: Joi.array()
    .items(Joi.string())
    .optional()
    .messages({
      "array.base": "errors.permissions_must_be_array",
    }),
});

// Middleware for validating healthCenter input
const validateHealthCenterInput = (req, res, next) => {
  const { error } = healthCenterSchema.validate(req.body);

  if (error) {
    // If validation fails, send an error response
    return res.status(400).json({ success: false, message: req.t(error.details[0].message) });
  }

  // If validation passes, proceed to the next middleware
  next();
};

// Middleware for validating assign healthCenter admin input
const validateAssignHealthCenterAdminInput = (req, res, next) => {
  const { error } = assignHealthCenterAdminSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: req.t(error.details[0].message),
    });
  }

  next();
};

// Define create healthCenter user schema
const createHealthCenterUserSchema = Joi.object({
  user_id: Joi.string().uuid().required().messages({
    "any.required": "errors.user_id_required",
    "string.guid": "errors.invalid_uuid",
  }),

  role: Joi.string()
    .required()
    .messages({
      "any.required": "errors.role_required",
    }),

  permissions: Joi.array()
    .items(Joi.string())
    .optional()
    .messages({
      "array.base": "errors.permissions_must_be_array",
    }),
});

// Middleware for validating create healthCenter user input
const validateCreateHealthCenterUserInput = (req, res, next) => {
  const { error } = createHealthCenterUserSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: req.t(error.details[0].message),
    });
  }

  next();
};

// Define assign PC worker validator schema
const assignPCWorkerSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "any.required": "errors.user_id_required",
    "string.guid": "errors.invalid_uuid",
  }),

  unitIds: Joi.array()
    .items(Joi.string().uuid())
    .required()
    .messages({
      "array.base": "errors.unit_ids_must_be_array",
      "any.required": "errors.unit_ids_required",
      "string.guid": "errors.invalid_uuid",
    }),

  role: Joi.string().optional(),

  permissions: Joi.array().items(Joi.string()).optional().messages({
    "array.base": "errors.permissions_must_be_array",
  }),
});

// Middleware for validating assign PC worker input
const validateAssignPCWorkerInput = (req, res, next) => {
  const { error } = assignPCWorkerSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: req.t(error.details[0].message),
    });
  }

  next();
};

module.exports = {
  validateHealthCenterInput,
  validateAssignHealthCenterAdminInput,
  validateCreateHealthCenterUserInput,
  validateAssignPCWorkerInput,
};
