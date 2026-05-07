const Joi = require("joi");
const { AppError } = require("../middlewares/errorMiddleware");

const validateGroupInput = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().min(2).max(100).required(),
        specialization: Joi.string().valid("MINING", "POLLUTION", "FOREST", "GENERAL").optional().default("GENERAL"),
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return next(new AppError(error.details[0].message, 400));
    }
    next();
};

const validateAssignGroupUserInput = (req, res, next) => {
    const schema = Joi.object({
        user_id: Joi.string().uuid().required(),
        role: Joi.string().valid("GROUP_LEADER", "PROFESSIONAL").required(),
        permissions: Joi.array().items(Joi.string()).optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return next(new AppError(error.details[0].message, 400));
    }
    next();
};

module.exports = {
    validateGroupInput,
    validateAssignGroupUserInput,
};
