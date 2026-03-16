import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface-card mx-auto max-w-md p-8">
      <p className="page-eyebrow">Welcome back</p>
      <h1 className="title-serif mt-3 text-3xl font-semibold text-[#203245]">Login</h1>
      <p className="mt-3 text-sm leading-6 text-[#6b7280]">
        Sign in to manage your loans, check notifications, and browse the catalog.
      </p>

      {error && (
        <div className="notice-error mt-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <label className="block">
          <span className="field-label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            required
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            className="field-input"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="button-primary w-full"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6b7280]">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-[#163b63] hover:text-[#122f50]">
          Register here
        </Link>
      </p>
    </section>
  );
}

export default LoginPage;
