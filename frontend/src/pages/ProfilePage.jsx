import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getProfile } from '../services/api.js';

function ProfileStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
      <p className="text-sm text-[#6b7280]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#203245]">{value || '-'}</p>
    </div>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadProfile = async () => {
      try {
        const data = await getProfile();
        setProfile(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate, user]);

  if (loading) {
    return <div className="surface-card-soft p-10 text-center text-[#5f6f81]">Loading profile...</div>;
  }

  if (error) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <section className="page-shell">
      <div className="surface-card p-8">
        <p className="page-eyebrow">Account</p>
        <h1 className="title-serif mt-3 text-4xl font-semibold text-[#203245]">My Profile</h1>
        <p className="mt-3 max-w-2xl text-[#6b7280]">
          Your membership details, access role, and account status for the UniLib platform.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ProfileStat label="Full name" value={profile?.name} />
        <ProfileStat label="Email" value={profile?.email} />
        <ProfileStat label="Role" value={profile?.role} />
        <ProfileStat label="Membership" value={profile?.membershipStatus} />
      </div>

      <div className="surface-card p-8">
        <h2 className="text-xl font-semibold text-[#203245]">Account summary</h2>
        <dl className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <dt className="text-sm uppercase tracking-[0.16em] text-[#6b7280]">User ID</dt>
            <dd className="mt-2 text-[#203245]">{profile?._id || profile?.id || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm uppercase tracking-[0.16em] text-[#6b7280]">Joined</dt>
            <dd className="mt-2 text-[#203245]">
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export default ProfilePage;
