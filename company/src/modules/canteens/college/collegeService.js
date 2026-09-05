import { get, post, patch } from "../../../services/api";

export function listColleges() {
  return get("/colleges/admin");
}

export function createCollege(name) {
  return post("/colleges/create", { name });
}

export function toggleCollege(collegeId) {
  return patch(`/colleges/${collegeId}/toggle`);
}
