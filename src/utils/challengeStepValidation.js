const { AppError } = require("../middlewares/errorMiddleware");

/**
 * Validates quiz `question` steps before persisting. Aligns with frontend `validateQuestionContent`.
 * @param {unknown} steps
 */
function validateGamificationSteps(steps) {
  if (steps == null) return;
  if (!Array.isArray(steps)) {
    throw new AppError("steps must be an array", 400);
  }

  steps.forEach((step, i) => {
    const n = i + 1;
    if (!step || typeof step !== "object") {
      throw new AppError(`Step ${n} is invalid`, 400);
    }
    if (step.type === "scenario") {
      const c = step.content && typeof step.content === "object" ? step.content : {};
      const situation = String(c.situation ?? "").trim();
      if (!situation) {
        throw new AppError(`Step ${n}: scenario needs a situation description`, 400);
      }
      const opts = Array.isArray(c.options) ? c.options : [];
      if (opts.length !== 2) {
        throw new AppError(`Step ${n}: scenario must have exactly two choices`, 400);
      }
      const correct = opts.filter((o) => o && o.isCorrect === true).length;
      if (correct !== 1) {
        throw new AppError(`Step ${n}: scenario must have exactly one correct choice`, 400);
      }
      for (const o of opts) {
        if (!o || !String(o.text ?? "").trim()) {
          throw new AppError(`Step ${n}: each scenario choice needs text`, 400);
        }
      }
      return;
    }

    if (step.type !== "question") return;

    const c = step.content && typeof step.content === "object" ? step.content : {};
    const question = String(c.question ?? "").trim();
    if (!question) {
      throw new AppError(`Step ${n}: quiz question text is required`, 400);
    }

    const options = Array.isArray(c.options) ? c.options : [];
    if (options.length === 0) {
      throw new AppError(`Step ${n}: add at least one answer choice`, 400);
    }

    for (const opt of options) {
      if (!opt || typeof opt !== "object" || !String(opt.text ?? "").trim()) {
        throw new AppError(`Step ${n}: every answer choice needs a label`, 400);
      }
    }

    const kind = c.questionKind ?? "multiple_choice";
    const correctCount = options.filter((o) => o && o.isCorrect === true).length;

    if (kind === "true_false") {
      if (options.length !== 2) {
        throw new AppError(`Step ${n}: true/false must have exactly two choices`, 400);
      }
      if (correctCount !== 1) {
        throw new AppError(`Step ${n}: true/false must have exactly one correct answer`, 400);
      }
      if (c.multipleAnswers === true) {
        throw new AppError(`Step ${n}: true/false cannot allow multiple correct answers`, 400);
      }
      return;
    }

    if (kind === "binary_verdict") {
      if (options.length !== 2) {
        throw new AppError(`Step ${n}: binary verdict must have exactly two choices`, 400);
      }
      if (correctCount !== 1) {
        throw new AppError(`Step ${n}: binary verdict must have exactly one correct answer`, 400);
      }
      if (!String(c.scenarioBody ?? "").trim()) {
        throw new AppError(`Step ${n}: binary verdict needs a mock message body`, 400);
      }
      return;
    }

    if (options.length < 2) {
      throw new AppError(`Step ${n}: multiple choice needs at least two options`, 400);
    }
    if (correctCount < 1) {
      throw new AppError(`Step ${n}: mark at least one correct answer`, 400);
    }
    if (!c.multipleAnswers && correctCount !== 1) {
      throw new AppError(
        `Step ${n}: single-answer multiple choice must have exactly one correct option, or enable multiple correct`,
        400,
      );
    }
  });
}

module.exports = { validateGamificationSteps };
