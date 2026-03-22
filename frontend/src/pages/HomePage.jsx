import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBooks } from '../services/api.js';

function HomePage() {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const latestRequestRef = useRef(0);
  const availableTitles = books.filter((book) => book.availableCopies > 0).length;
  const categoryCount = new Set(books.map((book) => book.category).filter(Boolean)).size;

  const fetchBooks = async (query = '') => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setLoading(true);

    try {
      const data = await getBooks(query);

      if (latestRequestRef.current !== requestId) {
        return;
      }

      setBooks(Array.isArray(data) ? data : data.books || []);
    } catch (error) {
      console.error('Failed to fetch books:', error);

      if (latestRequestRef.current !== requestId) {
        return;
      }

      setBooks([]);
    } finally {
      if (latestRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchBooks(search.trim());
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [search]);

  const handleSearch = (event) => {
    event.preventDefault();
    fetchBooks(search.trim());
  };

  return (
    <section className="page-shell">
      <div className="surface-card p-6 sm:p-8">
        <p className="page-eyebrow">Catalog</p>
        <h1 className="page-title title-serif">
          Explore the UniLib collection
        </h1>
        <p className="page-copy">
          Search by title, author, or ISBN and open any record to see availability before borrowing.
        </p>

        <form onSubmit={handleSearch} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search books by title, author, or ISBN"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="field-input flex-1"
          />
          <button
            type="submit"
            className="button-primary px-5 py-3"
          >
            Search
          </button>
        </form>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
            <p className="text-sm text-[#6b7280]">Titles indexed</p>
            <p className="mt-2 text-2xl font-semibold text-[#203245]">{books.length}</p>
          </div>
          <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
            <p className="text-sm text-[#6b7280]">Available now</p>
            <p className="mt-2 text-2xl font-semibold text-[#203245]">{availableTitles}</p>
          </div>
          <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
            <p className="text-sm text-[#6b7280]">Categories</p>
            <p className="mt-2 text-2xl font-semibold text-[#203245]">{categoryCount}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="surface-card-soft p-10 text-center text-[#5f6f81]">
          Loading books...
        </div>
      ) : books.length === 0 ? (
        <div className="surface-card-soft border-dashed p-10 text-center text-[#5f6f81]">
          No books found.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <button
              key={book._id}
              type="button"
              onClick={() => navigate(`/books/${book._id}`)}
              className="group rounded-2xl border border-[#e4e0d9] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#cfd8e3] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#203245]">{book.title}</h2>
                  <p className="mt-2 text-sm text-[#6b7280]">by {book.author}</p>
                </div>
                <span className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-xs uppercase tracking-[0.15em] text-[#64748b]">
                  {book.category || 'General'}
                </span>
              </div>

              <div className="mt-5 space-y-2 text-sm text-[#5f6f81]">
                <p>ISBN: {book.isbn || 'Not available'}</p>
                <p>Copies: {book.totalCopies ?? 0}</p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <span
                  className={[
                    'inline-flex rounded-full px-3 py-1 text-sm font-medium',
                    book.availableCopies > 0
                      ? 'bg-[#ecf6f2] text-[#2c6558]'
                      : 'bg-[#fff1eb] text-[#9a3412]',
                  ].join(' ')}
                >
                  {book.availableCopies > 0
                    ? `${book.availableCopies} available`
                    : 'No copies available'}
                </span>
                <span className="text-sm font-medium text-[#163b63]">View details</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default HomePage;
