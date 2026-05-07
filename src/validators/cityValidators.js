const Joi = require("joi");

// Define the group validation schema
const citySchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "errors.city_name_required",
    "any.required": "errors.city_name_required",
  }),
});

// Middleware for validating group input
const validateCityInput = (req, res, next) => {
  const { error } = citySchema.validate(req.body);

  if (error) {
    // If validation fails, send an error response
    return res.status(400).json({ success: false, message: req.t(error.details[0].message) });
  }

  // If validation passes, proceed to the next middleware
  next();
};
// Define assign user validation schema
const assignUserSchema = Joi.object({
  userId: Joi.string()
    .uuid()
    .required()
    .messages({
      "string.empty": "errors.user_id_required",
      "any.required": "errors.user_id_required",
      "string.guid": "errors.invalid_uuid",
    }),

  cityId: Joi.string()
    .uuid()
    .required()
    .messages({
      "string.empty": "errors.city_id_required",
      "any.required": "errors.city_id_required",
      "string.guid": "errors.invalid_uuid",
    }),

  permissions: Joi.array()
    .items(Joi.string())
    .optional()
    .messages({
      "array.base": "errors.permissions_must_be_array",
    }),
});

// Middleware for validating assign user input
const validateAssignUserInput = (req, res, next) => {
  const { error } = assignUserSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: req.t(error.details[0].message),
    });
  }

  next();
};



const createEthiopiaUserSchema = Joi.object({
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

// Middleware for validating assign user input
const validateCreateEthiopiaUserInput = (req, res, next) => {
  const { error } = createEthiopiaUserSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: req.t(error.details[0].message),
    });
  }

  next();
};

const unassignUserSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.empty": "errors.user_id_required",
    "string.guid": "errors.invalid_uuid",
    "any.required": "errors.user_id_required",
  }),
});

// Middleware to validate input
const validateUnassignUserInput = (req, res, next) => {
  const { error } = unassignUserSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: req.t(error.details[0].message),
    });
  }

  next();
};

// Schema for updating user permissions
const updatePermissionsSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.empty": "errors.user_id_required",
    "string.guid": "errors.invalid_uuid",
    "any.required": "errors.user_id_required",
  }),
  permissions: Joi.array()
    .items(Joi.string())
    .required()
    .messages({
      "array.base": "errors.permissions_must_be_array",
    }),
});

// Middleware to validate input
const validateUpdatePermissionsInput = (req, res, next) => {
  const { error } = updatePermissionsSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: req.t(error.details[0].message),
    });
  }

  next();
};





module.exports = {
  validateCityInput,
  validateAssignUserInput,
  validateCreateEthiopiaUserInput,
  validateUnassignUserInput,
  validateUpdatePermissionsInput,
};
