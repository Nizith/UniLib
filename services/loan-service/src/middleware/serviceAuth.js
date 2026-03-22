const INTERNAL_SERVICE_HEADER = "x-internal-service-token";

const requireInternalService = (req, res, next) => {
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({ message: "Internal service authentication is not configured" });
  }

  if (req.header(INTERNAL_SERVICE_HEADER) !== expectedToken) {
    return res.status(403).json({ message: "Internal service access denied" });
  }

  return next();
};

module.exports = { requireInternalService, INTERNAL_SERVICE_HEADER };
