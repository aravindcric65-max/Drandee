const crypto = require("crypto");

const getExperimentPercent = () => {
  const value = Number(
    process.env.LEVEL6_EXPERIMENT_PERCENT || 10
  );

  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.min(
    Math.max(value, 0),
    100
  );
};

const calculateVariant = (userId) => {
  const hash = crypto
    .createHash("sha256")
    .update(String(userId))
    .digest("hex");

  const bucket =
    parseInt(hash.slice(0, 8), 16) %
    100;

  const experimentPercent =
    getExperimentPercent();

  return bucket < experimentPercent
    ? "level6"
    : "control";
};

module.exports = {
  calculateVariant,
  getExperimentPercent,
};