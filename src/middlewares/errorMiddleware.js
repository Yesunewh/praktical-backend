class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // To differentiate between operational and programmer errors
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // If the message is a translation key (starts with errors.), translate it
  if (req.t && typeof message === "string" && message.startsWith("errors.")) {
    message = req.t(message);
  }

  // Log the error stack for debugging
  if (process.env.NODE_ENV === "development") {
    console.error(err.stack);
  }

  // Send the response
  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = { errorMiddleware, AppError };

