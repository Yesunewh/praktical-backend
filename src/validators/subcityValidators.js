const Joi = require("joi");

// Define the subcity validation schema
const subcitySchema = Joi.object({
    name: Joi.string().required().messages({
        "string.empty": "errors.subcity_name_required",
        "any.required": "errors.subcity_name_required",
    }),
});

// Define assign subcity admin validation schema
const assignSubcityAdminSchema = Joi.object({
    userId: Joi.string()
        .uuid()
        .required()
        .messages({
            "string.empty": "errors.user_id_required",
            "any.required": "errors.user_id_required",
            "string.guid": "errors.invalid_uuid",
        }),

    subcityId: Joi.string()
        .uuid()
        .required()
        .messages({
            "string.empty": "errors.subcity_id_required",
            "any.required": "errors.subcity_id_required",
            "string.guid": "errors.invalid_uuid",
        }),

    permissions: Joi.array()
        .items(Joi.string())
        .optional()
        .messages({
            "array.base": "errors.permissions_must_be_array",
        }),
});

// Middleware for validating subcity input
const validateSubcityInput = (req, res, next) => {
    const { error } = subcitySchema.validate(req.body);

    if (error) {
        // If validation fails, send an error response
        return res.status(400).json({ success: false, message: req.t(error.details[0].message) });
    }

    // If validation passes, proceed to the next middleware
    next();
};

// Middleware for validating assign subcity admin input
const validateAssignSubcityAdminInput = (req, res, next) => {
    const { error } = assignSubcityAdminSchema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: req.t(error.details[0].message),
        });
    }

    next();
};

// Define create subcity user schema
const createSubcityUserSchema = Joi.object({
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

// Middleware for validating create subcity user input
const validateCreateCityUserInput = (req, res, next) => {
    const { error } = createSubcityUserSchema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: req.t(error.details[0].message),
        });
    }

    next();
};

module.exports = {
    validateSubcityInput,
    validateAssignSubcityAdminInput,
    validateCreateCityUserInput,
};
