/**
 * V1 technician identity helpers.
 *
 * Approved production contract:
 * - auth.users.id identifies the logged-in user
 * - technicians.user_id links a roster row to auth.users.id (auth mapping only)
 * - technicians.id is the authoritative technician assignment ID
 * - jobs.technician_id / appointments.technician_id / inspections.technician_id
 *   must store technicians.id
 *
 * Resolve login → roster via:
 *   auth user id → technicians.user_id → technicians.id
 *
 * Assignment UI option values must be technicians.id, never technicians.user_id.
 */

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/** Safe roster columns for assignment selectors and login resolution. */
export const TECHNICIAN_ROSTER_SELECT = 'id, user_id, full_name, is_active';

/**
 * Find a technician roster row from a stored assignment value or select value.
 * Accepts technicians.id (preferred) or legacy technicians.user_id for display/read.
 */
export const findTechnicianByAnyId = (technicians, value) => {
  const needle = asText(value);
  if (!needle || !Array.isArray(technicians)) return null;
  return (
    technicians.find((tech) => asText(tech?.id) === needle) ||
    technicians.find((tech) => asText(tech?.user_id) === needle) ||
    null
  );
};

/**
 * Normalize any known technician id shape to the roster assignment id.
 * Returns null when the value cannot be mapped to a roster row.
 */
export const resolveTechnicianRosterId = ({ technicians, value }) => {
  const needle = asText(value);
  if (!needle || needle === 'unassigned') return null;
  const technician = findTechnicianByAnyId(technicians, needle);
  return technician?.id ? asText(technician.id) : null;
};

/**
 * Select / form value for assignment controls.
 * Always prefers technicians.id so writes store the roster FK target.
 */
export const resolveTechnicianSelectValue = ({ technicians, value }) => {
  const rosterId = resolveTechnicianRosterId({ technicians, value });
  return rosterId || 'unassigned';
};

/**
 * Display name for a stored assignment id (roster id, or legacy user_id).
 */
export const resolveTechnicianDisplayName = ({
  technicians,
  value,
  fallback = 'Unassigned',
}) => {
  const technician = findTechnicianByAnyId(technicians, value);
  return asText(technician?.full_name) || fallback;
};

/**
 * Auth-user mapping only — never write this into assignment columns.
 */
export const resolveTechnicianAuthUserId = ({ technicians, value }) => {
  const technician = findTechnicianByAnyId(technicians, value);
  return technician?.user_id ? asText(technician.user_id) : null;
};

/**
 * Resolve the logged-in user's roster id from a technicians list.
 */
export const resolveLoggedInTechnicianRosterId = ({ technicians, authUserId }) => {
  const userId = asText(authUserId);
  if (!userId || !Array.isArray(technicians)) return null;
  const technician = technicians.find((tech) => asText(tech?.user_id) === userId);
  return technician?.id ? asText(technician.id) : null;
};
