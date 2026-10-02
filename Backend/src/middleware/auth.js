import jwt from "jsonwebtoken";

export function authenticateUser(req, res, next) {
  try {
    const token =
      req.cookies?.jwt ||
      req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET is missing.");
      return res.status(500).json({
        success: false,
        error: "Internal server error.",
      });
    }

    const decoded = jwt.verify(token, secret);
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token.",
    });
  }
}
