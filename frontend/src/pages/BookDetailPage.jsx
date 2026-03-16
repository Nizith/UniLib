import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { borrowBook, getBookById } from '../services/api.js';

function DetailRow({ label, value }) {
  return (
    <div className="grid gap-2 border-t border-[#ece8e0] py-4 sm:grid-cols-[160px_1fr]">
      <span className="text-sm uppercase tracking-[0.2em] text-[#6b7280]">{label}</span>
      <span className="text-[#203245]">{value}</span>
    </div>
  );
}

function BookDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [borrowing, setBorrowing] = useState(false);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        const data = await getBookById(id);
        setBook(data);
      } catch {
        setError('Failed to load book details.');
      } finally {
        setLoading(false);
      }
    };

    fetchBook();
  }, [id]);

  const handleBorrow = async () => {
    setMessage('');
    setError('');
    setBorrowing(true);

    try {
      await borrowBook(book._id);
      setMessage('Book borrowed successfully! Check your loans page.');
      const updated = await getBookById(id);
      setBook(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to borrow book. Please try again.');
    } finally {
      setBorrowing(false);
    }
  };

  if (loading) {
    return (
      <div className="surface-card-soft p-10 text-center text-[#5f6f81]">
        Loading book details...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="surface-card-soft border-dashed p-10 text-center text-[#5f6f81]">
        Book not found.
      </div>
    );
  }

  return (
    <section className="surface-card p-8">
      <div className="flex flex-col gap-4 border-b border-[#ece8e0] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="page-eyebrow">Book details</p>
          <h1 className="title-serif mt-3 text-4xl font-semibold text-[#203245]">{book.title}</h1>
          <p className="mt-2 text-[#6b7280]">{book.author}</p>
        </div>
        <span
          className={[
            'inline-flex rounded-full px-4 py-2 text-sm font-medium',
            book.availableCopies > 0 ? 'bg-[#ecf6f2] text-[#2c6558]' : 'bg-[#fff1eb] text-[#9a3412]',
          ].join(' ')}
        >
          {book.availableCopies} of {book.totalCopies} available
        </span>
      </div>

      {message && (
        <div className="notice-success mt-6">
          {message}
        </div>
      )}

      {error && (
        <div className="notice-error mt-6">
          {error}
        </div>
      )}

      <div className="mt-6">
        <DetailRow label="Author" value={book.author} />
        {book.isbn && <DetailRow label="ISBN" value={book.isbn} />}
        {book.category && <DetailRow label="Category" value={book.category} />}
        {book.publisher && <DetailRow label="Publisher" value={book.publisher} />}
        {book.publishedYear && <DetailRow label="Published year" value={book.publishedYear} />}
        {book.description && <DetailRow label="Description" value={book.description} />}
      </div>

      <div className="mt-8">
        {user && book.availableCopies > 0 && (
          <button
            type="button"
            onClick={handleBorrow}
            disabled={borrowing}
            className="button-primary px-5 py-3"
          >
            {borrowing ? 'Borrowing...' : 'Borrow This Book'}
          </button>
        )}

        {!user && <p className="text-sm text-[#6b7280]">Please log in to borrow this book.</p>}

        {user && book.availableCopies === 0 && (
          <p className="text-sm text-[#9a3412]">No copies currently available for borrowing.</p>
        )}
      </div>
    </section>
  );
}

export default BookDetailPage;
