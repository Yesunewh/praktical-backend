const Joi = require("joi");

const uuidGuid = () =>
  Joi.string()
    .guid({ version: ["uuidv4"] })
    .allow(null, "")
    .optional();

/** Match login / admin UI: accept +251 / 251… and store as 10-digit local. */
function normalizeRegistrationPhone(body) {
  if (!body || typeof body.phone_number !== "string") return;
  let s = body.phone_number.trim().replace(/\s+/g, "");
  if (s.startsWith("+251")) s = "0" + s.slice(4);
  else if (/^251\d{9}$/.test(s)) s = "0" + s.slice(3);
  body.phone_number = s;
}

/** Accept camelCase from clients; Joi only validates snake_case keys. */
function normalizeRegistrationIds(body) {
  if (!body || typeof body !== "object") return;
  if (body.deptId != null && (body.dept_id === undefined || body.dept_id === null || body.dept_id === "")) {
    body.dept_id = body.deptId;
  }
  if (body.orgId != null && (body.org_id === undefined || body.org_id === null || body.org_id === "")) {
    body.org_id = body.orgId;
  }
  delete body.deptId;
  delete body.orgId;
}

// Define the validation schema
const userSchema = Joi.object({
  first_name: Joi.string().min(1).max(30).required().messages({
    "string.empty": "First name is required.",
    "string.min": "First name must be at least 1 characters long.",
    "string.max": "First name must be less than or equal to 30 characters.",
  }),
  last_name: Joi.string().min(1).max(30).required().messages({
    "string.empty": "Last name is required.",
    "string.min": "Last name must be at least 1 characters long.",
    "string.max": "Last name must be less than or equal to 30 characters.",
  }),
  email: Joi.string()
    .email()
    .allow("")
    .optional()
    .messages({
      "string.email": "Please enter a valid email address.",
    }),
  phone_number: Joi.string()
    .length(10)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.empty": "Phone number is required.",
      "string.length": "Phone number must be exactly 10 digits long.",
      "string.pattern.base": "Phone number must contain only numbers.",
    }),
  username: Joi.string().min(3).max(30).allow("").optional().messages({
    "string.min": "Username must be at least 3 characters long.",
    "string.max": "Username must be less than or equal to 30 characters.",
  }),
  language_preference: Joi.string().valid("eng", "am", "orm", "som", "tir", "sid").optional().messages({
    "any.only": "Language preference must be one of: eng, am, orm, som, tir, sid.",
  }),
  password: Joi.string()
    .min(6) // 
    .required()
    .messages({
      "string.min": "Password must be at least 6 characters long.",
      "any.required": "Password is required.",
    }),
  user_type: Joi.string().valid("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN", "DEPT_ADMIN", "STAFF", "EXTERNAL").optional(),
  org_id: uuidGuid(),
  dept_id: uuidGuid(),
  unit_id: uuidGuid(),
  role_id: uuidGuid(),
  status: Joi.string().valid("UNASSIGNED", "ACTIVE", "DEACTIVATED").optional(),
});

// Middleware to validate user data
const validateUser = (req, res, next) => {
  normalizeRegistrationIds(req.body);
  normalizeRegistrationPhone(req.body);
  const { error } = userSchema.validate(req.body, { abortEarly: true });
  if (error) {
    const detail = error.details[0];
    const fieldKey = detail.context.label || detail.path[0];
    let message = detail.message;

    if (req.t) {
      // Translate the field label
      const field = req.t(`fields.${fieldKey}`);

      if (detail.type === "any.required" || detail.type === "string.empty") {
        message = req.t("errors.field_required").replace("{{field}}", field);
      } else if (detail.type === "string.min") {
        message = req.t("errors.min_length")
          .replace("{{field}}", field)
          .replace("{{min}}", detail.context.limit);
      } else if (detail.type === "string.max") {
        message = req.t("errors.max_length")
          .replace("{{field}}", field)
          .replace("{{max}}", detail.context.limit);
      }
    }

    return res.status(400).json({ success: false, message });
  }
  next();
};
const updateUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(30).required().messages({
    "string.empty": "First name is required.",
    "string.min": "First name must be at least 1 characters long.",
    "string.max": "First name must be less than or equal to 30 characters.",
  }),
  lastName: Joi.string().min(1).max(30).required().messages({
    "string.empty": "Last name is required.",
    "string.min": "Last name must be at least 1 characters long.",
    "string.max": "Last name must be less than or equal to 30 characters.",
  }),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .allow("")
    .optional(),
  phoneNumber: Joi.string()
    .length(10)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.empty": "Phone number is required.",
      "string.length": "Phone number must be exactly 10 digits long.",
      "string.pattern.base": "Phone number must contain only numbers.",
    }),
  username: Joi.string().min(3).max(30).allow("").optional(),
  language_preference: Joi.string().valid("eng", "am", "orm", "som", "tir", "sid").optional(),
});

const validateUserUpdate = (req, res, next) => {
  const { error } = updateUserSchema.validate(req.body);
  if (error) {
    const detail = error.details[0];
    const path = detail.path[0];

    // Map camelCase fields to snake_case for locale keys
    const fieldMapping = {
      firstName: "first_name",
      lastName: "last_name",
      phoneNumber: "phone_number",
    };
    const fieldKey = fieldMapping[path] || path;
    let message = detail.message;

    if (req.t) {
      const field = req.t(`fields.${fieldKey}`);
      if (detail.type === "any.required" || detail.type === "string.empty") {
        message = req.t("errors.field_required").replace("{{field}}", field);
      } else if (detail.type === "string.min") {
        message = req.t("errors.min_length")
          .replace("{{field}}", field)
          .replace("{{min}}", detail.context.limit);
      } else if (detail.type === "string.max") {
        message = req.t("errors.max_length")
          .replace("{{field}}", field)
          .replace("{{max}}", detail.context.limit);
      } else if (detail.type === "string.length") {
        message = req.t("errors.min_length")
          .replace("{{field}}", field)
          .replace("{{min}}", detail.context.limit);
      }
    }

    return res.status(400).json({ success: false, message });
  }
  next();
};

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .min(6) // Minimum 8 characters
    .required()
    .messages({
      "string.min": "Password must be at least 6 characters long.",
      "any.required": "Password is required.",
    }),
  newPassword: Joi.string()
    .min(6) // Minimum 8 characters
    .required()
    .messages({
      "string.min": "Password must be at least 6 characters long.",
      "any.required": "Password is required.",
    }),
  userId: Joi.number().integer().optional().messages({
    "number.base": "New Group Leader ID must be a number.",
  }),
});
const validatePassword = (req, res, next) => {
  const { error } = updatePasswordSchema.validate(req.body);
  if (error) {
    const detail = error.details[0];
    const fieldKey = detail.context.label || detail.path[0];
    let message = detail.message;

    if (req.t) {
      // Translate the field label
      const field = req.t(`fields.${fieldKey}`);

      if (detail.type === "any.required" || detail.type === "string.empty") {
        message = req.t("errors.field_required").replace("{{field}}", field);
      } else if (detail.type === "string.min") {
        message = req.t("errors.min_length")
          .replace("{{field}}", field)
          .replace("{{min}}", detail.context.limit);
      }
    }

    return res.status(400).json({ success: false, message });
  }
  next();
};

const loginSchema = Joi.object({
  phone_number: Joi.string()
    .length(10)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.empty": "Phone number is required.",
      "string.length": "Phone number must be exactly 10 digits long.",
      "string.pattern.base": "Phone number must contain only numbers.",
    }),
  password: Joi.string()
    .min(6) // Minimum 8 characters
    .required()
    .messages({
      "string.min": "Password must be at least 6 characters long.",
      "any.required": "Password is required.",
    }),
});

const validateLoginInfo = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    const detail = error.details[0];
    const fieldKey = detail.context.label || detail.path[0];
    let message = detail.message;

    if (req.t) {
      const field = req.t(`fields.${fieldKey}`);
      if (detail.type === "any.required" || detail.type === "string.empty") {
        message = req.t("errors.field_required").replace("{{field}}", field);
      } else if (detail.type === "string.length") {
        message = req.t("errors.min_length")
          .replace("{{field}}", field)
          .replace("{{min}}", detail.context.limit);
      } else if (detail.type === "string.min") {
        message = req.t("errors.min_length")
          .replace("{{field}}", field)
          .replace("{{min}}", detail.context.limit);
      }
    }

    return res.status(400).json({ success: false, message });
  }
  next();
};

const validateEmailUserSchema = Joi.object({

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.empty": "Email is required.",
      "string.email": "Please enter a valid email address.",
    }),
});

const validateEmail = (req, res, next) => {
  const { error } = validateEmailUserSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });
  }
  next();
};

const validatePasswordUserSchema = Joi.object({
  password: Joi.string()
    .min(6) // Minimum 8 characters
    .required()
    .messages({
      "string.min": "Password must be at least 6 characters long.",
      "any.required": "Password is required.",
    }),
});

const validateResetPassword = (req, res, next) => {
  const { error } = validatePasswordUserSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });
  }
  next();
};



const validateEmailAttributesSchema = Joi.object({
  subject: Joi.string().min(3).max(255).required().messages({
    "string.base": "Subject must be a string.",
    "string.empty": "Subject cannot be empty.",
    "string.min": "Subject must be at least 3 characters long.",
    "string.max": "Subject must not exceed 255 characters.",
    "any.required": "Subject is required.",
  }),

  message: Joi.string().min(5).required().messages({
    "string.base": "Message must be a string.",
    "string.empty": "Message cannot be empty.",
    "string.min": "Message must be at least 5 characters long.",
    "any.required": "Message is required.",
  }),

  recipients: Joi.array()
    .items(
      Joi.object({
        full_name: Joi.string().min(1).required().messages({
          "string.base": "Full name must be a string.",
          "string.empty": "Full name is required.",
          "any.required": "Full name is required.",
        }),
        email: Joi.string().email().required().messages({
          "string.email": "Email must be a valid email address.",
          "any.required": "Email is required.",
        }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.base": "Recipients must be an array of recipient objects.",
      "array.min": "At least one recipient is required.",
      "any.required": "Recipients field is required.",
    }),
});

const validateEmailAttributes = (req, res, next) => {
  const { error } = validateEmailAttributesSchema.validate(req.body, {
    abortEarly: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  next();
};

const adminUserScopeSchema = Joi.object({
  org_id: uuidGuid(),
  dept_id: uuidGuid(),
  user_type: Joi.string()
    .valid("ORG_ADMIN", "UNIT_ADMIN", "DEPT_ADMIN", "STAFF", "EXTERNAL")
    .optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one of org_id, dept_id, or user_type is required.",
  });

const validateAdminUserScope = (req, res, next) => {
  const { error } = adminUserScopeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }
  next();
};

const approveApplicantSchema = Joi.object({
  org_id: uuidGuid(),
  dept_id: uuidGuid(),
  unit_id: uuidGuid(),
  role_id: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required()
    .messages({ "any.required": "Role is required." }),
});

const validateApproveApplicant = (req, res, next) => {
  const { error } = approveApplicantSchema.validate(req.body, { abortEarly: true });
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }
  next();
};

module.exports = {
  validateUser,
  validateUserUpdate,
  validatePassword,
  validateLoginInfo,
  validateEmail,
  validateResetPassword,
  validateEmailAttributes,
  validateAdminUserScope,
  validateApproveApplicant,
};
