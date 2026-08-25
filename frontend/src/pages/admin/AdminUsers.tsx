import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createAdminUser, deleteAdminUser, fetchAdminUsers, updateAdminUser, type AdminUser } from '../../api/admin'
import RowMenu from '../../components/RowMenu'

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function load() {
    fetchAdminUsers(search || undefined).then(setUsers)
  }

  useEffect(load, [search])

  function openCreate() {
    setEditing(null)
    setName('')
    setEmail('')
    setPassword('')
    setRole(0)
    setShowModal(true)
  }

  function openEdit(u: AdminUser) {
    setEditing(u)
    setName(u.name)
    setEmail(u.email)
    setPassword('')
    setRole(u.role)
    setShowModal(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (editing) {
        await updateAdminUser(editing.id, { name, email, role, password: password || undefined })
      } else {
        await createAdminUser({ name, email, password, role })
      }
      setShowModal(false)
      load()
    } catch {
      setError('Could not save user')
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Delete ${u.email}?`)) return
    await deleteAdminUser(u.id)
    load()
  }

  return (
    <div>
      <div className="section-row">
        <h1>Users</h1>
        <button onClick={openCreate}>+ New user</button>
      </div>

      <div className="card">
        <div className="card-toolbar">
          <h3>Users</h3>
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <table className="website-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Websites</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`pill ${u.role === 1 ? 'pill-blue' : ''}`}>{u.role === 1 ? 'Admin' : 'User'}</span>
                </td>
                <td>{u.has_websites ? 'Yes' : 'No'}</td>
                <td>
                  <RowMenu
                    actions={[
                      { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(u) },
                      { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => void handleDelete(u) },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2>{editing ? 'Edit user' : 'New user'}</h2>
            {error && <p className="error">{error}</p>}
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password {editing && <span className="muted">(leave blank to keep current)</span>}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!editing} minLength={8} />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(Number(e.target.value))}>
                <option value={0}>User</option>
                <option value={1}>Admin</option>
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
