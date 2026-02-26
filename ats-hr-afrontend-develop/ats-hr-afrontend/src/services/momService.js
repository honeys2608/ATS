import api from "../api/axios";

/**
 * Helper to normalize API responses
 * Supports:
 * - res.data
 * - res.data.data
 */
function unwrap(res) {
  return res?.data?.data ?? res?.data;
}

/* =========================
   MoM (Minutes of Meeting)
   ========================= */

/**
 * createMoM
 * - Create a new MoM for client or requirement
 *
 * Payload:
 * {
 *   entity_type: "client" | "requirement",
 *   entity_id: string,
 *   meeting_date: string,
 *   summary: string,
 *   decisions?: string,
 *   action_items?: [
 *     {
 *       description: string,
 *       owner_role: "recruiter" | "am" | "hr" | "accounts",
 *       due_date?: string
 *     }
 *   ]
 * }
 */
export async function createMoM(payload) {
  if (!payload) throw new Error("payload is required");

  const res = await api.post("/v1/mom", payload);
  return unwrap(res);
}

/**
 * getMoMs
 * - Fetch MoMs by entity
 *
 * Params:
 * - entity_type: "client" | "requirement"
 * - entity_id: string
 */
export async function getMoMs(entity_type, entity_id) {
  if (!entity_type || !entity_id) {
    throw new Error("entity_type and entity_id are required");
  }

  const res = await api.get("/v1/mom", {
    params: { entity_type, entity_id },
  });

  return unwrap(res);
}

/**
 * updateMoM
 * - Update MoM summary / decisions
 */
export async function updateMoM(mom_id, payload) {
  if (!mom_id || !payload) {
    throw new Error("mom_id and payload are required");
  }

  const res = await api.put(`/v1/mom/${mom_id}`, payload);
  return unwrap(res);
}

/* =========================
   MoM Action Items
   ========================= */

/**
 * closeActionItem
 * - Mark an MoM action item as closed
 */
export async function closeActionItem(action_item_id) {
  if (!action_item_id) {
    throw new Error("action_item_id is required");
  }

  const res = await api.patch(`/v1/mom/action-items/${action_item_id}/close`);

  return unwrap(res);
}
