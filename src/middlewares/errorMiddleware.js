class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // To differentiate between operational and programmer errors
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Handle Sequelize Validation Errors specifically
  if (err.name === "SequelizeValidationError" || err.name === "SequelizeUniqueConstraintError") {
    statusCode = 400;
    message = err.errors.map((e) => e.message).join(", ");
  }

  // If the message is a translation key (starts with errors.), translate it
  if (req.t && typeof message === "string" && message.startsWith("errors.")) {
    message = req.t(message);
  }

  // Log the error stack for debugging
  if (process.env.NODE_ENV === "development") {
    console.error("ERROR TYPE:", err.name);
    console.error("ERROR MESSAGE:", err.message);
    if (err.errors) console.error("DETAILED ERRORS:", err.errors);
  }

  // Send the response
  res.status(statusCode).json({
    success: false,
    message,
    errorType: err.name
  });
};

module.exports = { errorMiddleware, AppError };

