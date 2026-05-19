const Joi = require("joi");

const { Organization } = require("../models");

const orgSchema = Joi.object({
  name: Joi.string().max(255).required().messages({
    "string.empty": "Organization name is required.",
    "string.max": "Organization name must be less than or equal to 255 characters.",
  }),
  status: Joi.string().valid("ACTIVE", "SUSPENDED", "PENDING").optional(),
  subscription_plan: Joi.string().valid("BASIC", "PREMIUM", "ENTERPRISE").optional(),
  logo: Joi.any().optional(), // Allow the logo field from multipart
}).unknown(true); // Allow unknown fields like multer artifacts

const validateOrg = async (req, res, next) => {
  console.log("--- DEBUG: Organization Validation ---");
  console.log("Body:", req.body);
  console.log("File:", req.file ? "File Received" : "No File");

  const { error } = orgSchema.validate(req.body, { abortEarly: false });
  if (error) {
    console.log("Validation Failed. Body received:", req.body);
    const messages = error.details.map((d) => d.message);
    
    return res.status(400).json({ 
      success: false, 
      message: messages[0],
      details: messages
    });
  }

  // Pre-check for Uniqueness (Case-Insensitive & Trimmed)
  let { name } = req.body;
  if (name) {
    name = name.trim();
    const { Op } = require("sequelize");
    const existing = await Organization.findOne({ 
      where: { 
        name: { [Op.iLike]: name } 
      } 
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `The organization name "${name}" is already taken.`
      });
    }
  }

  next();
};

module.exports = { validateOrg };
