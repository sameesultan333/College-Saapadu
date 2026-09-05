import { useEffect, useState } from "react";
import { listColleges, createCollege, toggleCollege } from "./collegeService";
import "./college.css";

export default function CollegePage() {
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await listColleges();
      setColleges(data);
    } catch (err) {
      setError(err.message || "Unable to load colleges");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("College name is required");
      return;
    }

    setCreating(true);
    try {
      await createCollege(name.trim());
      setName("");
      await refresh();
    } catch (err) {
      setFormError(err.message || "Unable to create college");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(collegeId) {
    try {
      await toggleCollege(collegeId);
      await refresh();
    } catch (err) {
      setError(err.message || "Unable to update college");
    }
  }

  return (
    <div className="college-page">
      <section className="college-create">
        <h2>Add College</h2>
        <form onSubmit={handleCreate}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crescent Institute"
          />
          <button type="submit" disabled={creating}>
            {creating ? "Adding..." : "Add College"}
          </button>
        </form>
        {formError && <div className="college-error">{formError}</div>}
      </section>

      <section className="college-list">
        <h2>Colleges</h2>

        {loading && <p className="college-hint">Loading...</p>}
        {error && <div className="college-error">{error}</div>}

        {!loading && colleges.length === 0 && (
          <p className="college-hint">No colleges yet. Add one above.</p>
        )}

        {!loading && colleges.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>
                    <span className={`badge ${c.is_active ? "active" : "inactive"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="toggle-btn" onClick={() => handleToggle(c.id)}>
                      {c.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
