import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { addBook, deleteBook, getBooks, updateBook } from '../services/api.js';

const emptyForm = {
  title: '',
  author: '',
  isbn: '',
  category: '',
  description: '',
  totalCopies: 1,
  availableCopies: 1,
  publishedYear: '',
};

function ManageBooksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canManage = user?.role === 'staff' || user?.role === 'admin';

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!canManage) {
      navigate('/');
      return;
    }

    loadBooks();
  }, [canManage, navigate, user]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const data = await getBooks();
      setBooks(Array.isArray(data) ? data : data.books || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load books.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (book) => {
    setEditingId(book._id);
    setMessage('');
    setError('');
    setForm({
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || '',
      category: book.category || '',
      description: book.description || '',
      totalCopies: book.totalCopies ?? 1,
      availableCopies: book.availableCopies ?? 1,
      publishedYear: book.publishedYear ?? '',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const payload = {
      ...form,
      totalCopies: Number(form.totalCopies),
      availableCopies: Number(form.availableCopies),
      publishedYear: form.publishedYear ? Number(form.publishedYear) : undefined,
    };

    try {
      if (editingId) {
        await updateBook(editingId, payload);
        setMessage('Book updated successfully.');
      } else {
        await addBook(payload);
        setMessage('Book added successfully.');
      }

      resetForm();
      await loadBooks();
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.[0]?.msg;
      setError(validationMessage || err.response?.data?.message || 'Failed to save book.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setMessage('');
    setError('');

    try {
      await deleteBook(id);
      setMessage('Book deleted successfully.');
      if (editingId === id) {
        resetForm();
      }
      await loadBooks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete book.');
    }
  };

  if (loading) {
    return <div className="surface-card-soft p-10 text-center text-[#5f6f81]">Loading catalog tools...</div>;
  }

  return (
    <section className="page-shell">
      <div className="surface-card p-8">
        <p className="page-eyebrow">Staff tools</p>
        <h1 className="title-serif mt-3 text-4xl font-semibold text-[#203245]">
          Manage Books
        </h1>
        <p className="mt-3 max-w-3xl text-[#6b7280]">
          Add new titles, edit catalog metadata, and keep availability aligned with the physical collection.
        </p>
      </div>

      {message && <div className="notice-success">{message}</div>}
      {error && <div className="notice-error">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[#203245]">
              {editingId ? 'Edit Book' : 'Add Book'}
            </h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="button-secondary px-3 py-2 text-sm">
                Cancel
              </button>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="field-label">Title</span>
              <input className="field-input" value={form.title} onChange={(e) => updateField('title', e.target.value)} required />
            </label>
            <label className="block">
              <span className="field-label">Author</span>
              <input className="field-input" value={form.author} onChange={(e) => updateField('author', e.target.value)} required />
            </label>
            <label className="block">
              <span className="field-label">ISBN</span>
              <input className="field-input" value={form.isbn} onChange={(e) => updateField('isbn', e.target.value)} required />
            </label>
            <label className="block">
              <span className="field-label">Category</span>
              <input className="field-input" value={form.category} onChange={(e) => updateField('category', e.target.value)} required />
            </label>
            <label className="block">
              <span className="field-label">Description</span>
              <textarea
                className="field-input min-h-28 resize-y"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Total copies</span>
                <input type="number" min="1" className="field-input" value={form.totalCopies} onChange={(e) => updateField('totalCopies', e.target.value)} required />
              </label>
              <label className="block">
                <span className="field-label">Available copies</span>
                <input type="number" min="0" className="field-input" value={form.availableCopies} onChange={(e) => updateField('availableCopies', e.target.value)} required />
              </label>
            </div>
            <label className="block">
              <span className="field-label">Published year</span>
              <input type="number" min="1000" max={new Date().getFullYear()} className="field-input" value={form.publishedYear} onChange={(e) => updateField('publishedYear', e.target.value)} />
            </label>
          </div>

          <button type="submit" disabled={saving} className="button-primary mt-6 w-full">
            {saving ? 'Saving...' : editingId ? 'Update Book' : 'Add Book'}
          </button>
        </form>

        <div className="surface-card overflow-hidden">
          <div className="border-b border-[#ece8e0] px-6 py-5">
            <h2 className="text-xl font-semibold text-[#203245]">Catalog inventory</h2>
            <p className="mt-2 text-sm text-[#6b7280]">{books.length} books currently in the system.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#ece8e0]">
              <thead className="bg-[#f8fafc] text-left text-sm uppercase tracking-[0.15em] text-[#6b7280]">
                <tr>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Copies</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece8e0] text-sm text-[#203245]">
                {books.map((book) => (
                  <tr key={book._id}>
                    <td className="px-6 py-4">
                      <div className="font-medium">{book.title}</div>
                      <div className="mt-1 text-[#6b7280]">{book.author}</div>
                    </td>
                    <td className="px-6 py-4">{book.category}</td>
                    <td className="px-6 py-4">
                      {book.availableCopies}/{book.totalCopies}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEdit(book)} className="button-secondary rounded-md px-3 py-2 text-sm">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(book._id)} className="rounded-md border border-[#f3c6b4] bg-[#fff2ec] px-3 py-2 text-sm font-medium text-[#9d4a26] transition hover:bg-[#fde9df]">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ManageBooksPage;
