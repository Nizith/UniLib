import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(name, email, password, role);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface-card mx-auto max-w-md p-8">
      <p className="page-eyebrow">Create account</p>
      <h1 className="title-serif mt-3 text-3xl font-semibold text-[#203245]">Register</h1>
      <p className="mt-3 text-sm leading-6 text-[#6b7280]">
        Set up your UniLib account to borrow books, review due dates, and receive updates.
      </p>

      {error && (
        <div className="notice-error mt-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <label className="block">
          <span className="field-label">Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your full name"
            required
            className="field-input"
          />
        </label>

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
            minLength={6}
            className="field-input"
          />
        </label>

        <label className="block">
          <span className="field-label">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="field-select"
          >
            <option value="student">Student</option>
            <option value="staff">Staff</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="button-primary w-full"
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6b7280]">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-[#163b63] hover:text-[#122f50]">
          Login here
        </Link>
      </p>
    </section>
  );
}

export default RegisterPage;
