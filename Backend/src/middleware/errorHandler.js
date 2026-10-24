export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === "23505") {
    return res.status(409).json({
      success: false,
      error: "A record with the same unique value already exists.",
      detail: err.detail,
    });
  }

  if (err.code === "23503") {
    return res.status(409).json({
      success: false,
      error: "The requested operation violates a database relationship.",
      detail: err.detail,
    });
  }

  if (err.code === "23514" || err.code === "22P02") {
    return res.status(400).json({
      success: false,
      error: "Invalid data supplied.",
      detail: err.message,
    });
  }

  if (err.code === "P0002") {
    return res.status(404).json({
      success: false,
      error: err.message,
    });
  }

  if (err.code === "22023") {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND") {
    return res.status(503).json({
      success: false,
      error: "Database connection failed. Please ensure PostgreSQL is running and credentials are configured.",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
}
