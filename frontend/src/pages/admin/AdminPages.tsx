import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createAdminPage, deleteAdminPage, fetchAdminPages, updateAdminPage, type AdminPage } from '../../api/admin'
import RowMenu from '../../components/RowMenu'

export default function AdminPages() {
  const [pages, setPages] = useState<AdminPage[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminPage | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [visibility, setVisibility] = useState(1)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  function load() {
    fetchAdminPages().then(setPages)
  }

  useEffect(load, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setSlug('')
    setVisibility(1)
    setContent('')
    setShowModal(true)
  }

  function openEdit(p: AdminPage) {
    setEditing(p)
    setName(p.name)
    setSlug(p.slug)
    setVisibility(p.visibility)
    setContent(p.content)
    setShowModal(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (editing) {
        await updateAdminPage(editing.id, { name, slug, visibility, content })
      } else {
        await createAdminPage({ name, slug, visibility, content })
      }
      setShowModal(false)
      load()
    } catch {
      setError('Could not save page')
    }
  }

  async function handleDelete(p: AdminPage) {
    if (!confirm(`Delete page "${p.name}"?`)) return
    await deleteAdminPage(p.id)
    load()
  }

  return (
    <div>
      <div className="section-row">
        <h1>Pages</h1>
        <button onClick={openCreate}>+ New page</button>
      </div>

      <div className="card">
        <div className="card-toolbar">
          <h3>CMS pages</h3>
        </div>
        <table className="website-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Visibility</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="muted">/pages/{p.slug}</td>
                <td>{p.visibility ? 'Visible' : 'Hidden'}</td>
                <td>
                  <RowMenu
                    actions={[
                      { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(p) },
                      { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => void handleDelete(p) },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No pages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: 480 }}>
            <h2>{editing ? 'Edit page' : 'New page'}</h2>
            {error && <p className="error">{error}</p>}
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Slug
              <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </label>
            <label>
              Visibility
              <select value={visibility} onChange={(e) => setVisibility(Number(e.target.value))}>
                <option value={1}>Visible</option>
                <option value={0}>Hidden</option>
              </select>
            </label>
            <label>
              Content
              <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
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
