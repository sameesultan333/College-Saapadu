import { useEffect, useState, type FormEvent } from "react";
import { listManagers, createManager, toggleManager, deleteManager, type Manager } from "./managerService";
import { listColleges } from "../canteens/college/collegeService";
import "../canteens/college/college.css";

interface College {
  id: number;
  name: string;
  is_active: boolean;
}

export default function ManagersPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [collegeId, setCollegeId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    const [collegeList, managerList] = await Promise.all([listColleges(), listManagers()]);
    setColleges(collegeList);
    setManagers(managerList);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (collegeId === "") {
      setError("Select a college");
      return;
    }

    setLoading(true);
    try {
      await createManager({ name, phone, password, college_id: Number(collegeId) });
      setName("");
      setPhone("");
      setPassword("");
      setCollegeId("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create manager");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(managerId: number) {
    await toggleManager(managerId);
    await loadAll();
  }

  async function handleDelete(manager: Manager) {
    const confirmed = window.confirm(
      `Permanently delete manager "${manager.name}"? This cannot be undone. Their canteens and staff are not affected.`
    );
    if (!confirmed) return;

    try {
      await deleteManager(manager.id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete manager");
    }
  }

  function collegeName(id: number) {
    return colleges.find((c) => c.id === id)?.name || `College ${id}`;
  }

  return (
    <div className="college-page">
      <section className="college-create">
        <h2>Add College Manager</h2>
        <form onSubmit={handleCreate} style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <input placeholder="Manager name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            maxLength={10}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <select
            value={collegeId}
            onChange={(e) => setCollegeId(e.target.value === "" ? "" : Number(e.target.value))}
            required
          >
            <option value="">Select college</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Manager"}
          </button>
        </form>
        {error && <div className="college-error">{error}</div>}
      </section>

      <section className="college-list">
        <h2>Managers</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>College</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {managers.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.phone}</td>
                <td>{collegeName(m.college_id)}</td>
                <td>
                  <span className={`badge ${m.is_active ? "active" : "inactive"}`}>
                    {m.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button className="toggle-btn" onClick={() => handleToggle(m.id)}>
                    {m.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button className="toggle-btn danger-btn" onClick={() => handleDelete(m)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {managers.length === 0 && <p className="college-hint">No managers yet.</p>}
      </section>
    </div>
  );
}
