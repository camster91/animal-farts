/**
 * Public social features are outside the approved v1 child-safety boundary.
 * They remain available only for deliberate, controlled testing builds.
 */
export const SOCIAL_FEATURES_ENABLED =
  import.meta.env.VITE_SOCIAL_FEATURES_ENABLED === "true";
