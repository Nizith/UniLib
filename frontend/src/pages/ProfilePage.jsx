import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  changePassword,
  deleteManageMember,
  deleteProfile,
  getManageMembers,
  getProfile,
  getStudents,
  updateProfile,
  updateManageMember,
  updateStudentMembership,
} from '../services/api.js';

function ProfilePage() {
  const { user, logout, updateStoredUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'student',
    membershipStatus: 'active',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [currentPasswordInvalid, setCurrentPasswordInvalid] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [studentsSuccess, setStudentsSuccess] = useState('');
  const [studentStatuses, setStudentStatuses] = useState({});
  const [studentSavingId, setStudentSavingId] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [membersSuccess, setMembersSuccess] = useState('');
  const [memberDrafts, setMemberDrafts] = useState({});
  const [memberSavingId, setMemberSavingId] = useState(null);
  const [memberDeletingId, setMemberDeletingId] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [adminMemberTab, setAdminMemberTab] = useState('students');
  const targetRole = adminMemberTab === 'students' ? 'student' : 'staff';
  const canEditAccessFields = profile?.role === 'admin';
  const canManageStudents = profile?.role === 'staff' || profile?.role === 'admin';
  const canSelfChangePassword = profile?.role === 'staff' || profile?.role === 'student';
  const isAdmin = profile?.role === 'admin';
  const adminVisibleMembers = members.filter(
    (member) => (member.role || '').toLowerCase() === targetRole
  );

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadProfile = async () => {
      try {
        const data = await getProfile();
        setProfile(data);
        setFormData({
          name: data?.name || '',
          email: data?.email || '',
          role: data?.role || 'student',
          membershipStatus: data?.membershipStatus || 'active',
        });
      } catch (err) {
        setLoadError(err.response?.data?.message || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate, user]);

  const loadStudents = async () => {
    setStudentsError('');
    setStudentsSuccess('');
    setStudentsLoading(true);

    try {
      const data = await getStudents();
      setStudents(data);
      setStudentStatuses(
        data.reduce((accumulator, student) => {
          accumulator[student._id || student.id] = student.membershipStatus;
          return accumulator;
        }, {})
      );
    } catch (err) {
      setStudentsError(err.response?.data?.message || 'Failed to load students.');
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadMembers = async () => {
    setMembersError('');
    setMembersSuccess('');
    setMembersLoading(true);

    try {
      const data = await getManageMembers();
      setMembers(data);
      setMemberDrafts(
        data.reduce((accumulator, member) => {
          const memberId = member._id || member.id;
          accumulator[memberId] = {
            name: member.name || '',
            email: member.email || '',
            role: (member.role || 'student').toLowerCase(),
            membershipStatus: member.membershipStatus || 'active',
            password: '',
          };
          return accumulator;
        }, {})
      );
    } catch (err) {
      setMembersError(err.response?.data?.message || 'Failed to load members.');
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'students' && canManageStudents && !isAdmin) {
      loadStudents();
    }
    if (activeTab === 'students' && isAdmin) {
      loadMembers();
    }
  }, [activeTab, canManageStudents, isAdmin]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
      };

      if (canEditAccessFields) {
        payload.role = formData.role;
        payload.membershipStatus = formData.membershipStatus;
      }

      const response = await updateProfile(payload);
      const updatedUser = response.user;

      setProfile((previous) => ({
        ...previous,
        ...updatedUser,
      }));
      setFormData((previous) => ({
        ...previous,
        ...updatedUser,
      }));
      updateStoredUser(updatedUser);
      setSuccess('Profile updated successfully.');
      setIsEditing(false);
    } catch (err) {
      const validationError = err.response?.data?.errors?.[0]?.msg;
      setError(validationError || err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditing = () => {
    setError('');
    setSuccess('');
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setError('');
    setFormData({
      name: profile?.name || '',
      email: profile?.email || '',
      role: profile?.role || 'student',
      membershipStatus: profile?.membershipStatus || 'active',
    });
    setIsEditing(false);
  };

  const handleDeleteProfile = async () => {
    const confirmed = window.confirm(
      'Delete your account permanently? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');
    setDeleting(true);

    try {
      await deleteProfile();
      logout();
      navigate('/register');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete profile.');
      setDeleting(false);
    }
  };

  const handleStudentStatusChange = (studentId, value) => {
    setStudentStatuses((previous) => ({
      ...previous,
      [studentId]: value,
    }));
  };

  const handleUpdateStudentMembership = async (studentId) => {
    setStudentsError('');
    setStudentsSuccess('');
    setStudentSavingId(studentId);

    try {
      const membershipStatus = studentStatuses[studentId];
      const response = await updateStudentMembership(studentId, membershipStatus);
      const updatedStudent = response.student;

      setStudents((previous) =>
        previous.map((student) =>
          (student._id || student.id) === studentId
            ? { ...student, membershipStatus: updatedStudent.membershipStatus }
            : student
        )
      );
      setStudentsSuccess(`Membership updated for ${updatedStudent.name}.`);
    } catch (err) {
      const validationError = err.response?.data?.errors?.[0]?.msg;
      setStudentsError(
        validationError || err.response?.data?.message || 'Failed to update membership.'
      );
    } finally {
      setStudentSavingId(null);
    }
  };

  const handleMemberDraftChange = (memberId, field, value) => {
    setMemberDrafts((previous) => ({
      ...previous,
      [memberId]: {
        ...(previous[memberId] || {}),
        [field]: value,
      },
    }));
  };

  const handleUpdateMember = async (memberId) => {
    setMembersError('');
    setMembersSuccess('');
    setMemberSavingId(memberId);

    try {
      const draft = memberDrafts[memberId] || {};
      const payload = {
        name: draft.name,
        email: draft.email,
        role: draft.role,
        membershipStatus: draft.membershipStatus,
      };

      if (typeof draft.password === 'string' && draft.password.trim()) {
        payload.password = draft.password;
      }

      const response = await updateManageMember(memberId, payload);
      const updatedMember = response.member;

      setMembers((previous) =>
        previous.map((member) =>
          (member._id || member.id) === memberId
            ? {
                ...member,
                name: updatedMember.name,
                email: updatedMember.email,
                role: updatedMember.role,
                membershipStatus: updatedMember.membershipStatus,
              }
            : member
        )
      );

      setMemberDrafts((previous) => ({
        ...previous,
        [memberId]: {
          ...previous[memberId],
          password: '',
        },
      }));

      setMembersSuccess(`Updated ${updatedMember.name} successfully.`);
      setEditingMemberId(null);
    } catch (err) {
      const validationError = err.response?.data?.errors?.[0]?.msg;
      setMembersError(validationError || err.response?.data?.message || 'Failed to update member.');
    } finally {
      setMemberSavingId(null);
    }
  };

  const handleStartMemberEdit = (member) => {
    const memberId = member._id || member.id;
    setMembersError('');
    setMembersSuccess('');
    setMemberDrafts((previous) => ({
      ...previous,
      [memberId]: {
        name: member.name || '',
        email: member.email || '',
        role: (member.role || 'student').toLowerCase(),
        membershipStatus: member.membershipStatus || 'active',
        password: '',
      },
    }));
    setEditingMemberId(memberId);
  };

  const handleCancelMemberEdit = () => {
    setEditingMemberId(null);
  };

  const handleDeleteMember = async (memberId, memberName) => {
    const confirmed = window.confirm(`Delete ${memberName}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setMembersError('');
    setMembersSuccess('');
    setMemberDeletingId(memberId);

    try {
      await deleteManageMember(memberId);
      setMembers((previous) => previous.filter((member) => (member._id || member.id) !== memberId));
      setMemberDrafts((previous) => {
        const clone = { ...previous };
        delete clone[memberId];
        return clone;
      });
      setMembersSuccess(`${memberName} deleted successfully.`);
    } catch (err) {
      setMembersError(err.response?.data?.message || 'Failed to delete member.');
    } finally {
      setMemberDeletingId(null);
    }
  };

  const handlePasswordFieldChange = (event) => {
    const { name, value } = event.target;

    if (name === 'currentPassword') {
      setCurrentPasswordInvalid(false);
      setPasswordError('');
    }

    setPasswordForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setPasswordSaving(true);

    try {
      const response = await changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmNewPassword
      );
      setPasswordSuccess(response.message || 'Password changed successfully.');
      setCurrentPasswordInvalid(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    } catch (err) {
      const validationError = err.response?.data?.errors?.[0]?.msg;
      const message = validationError || err.response?.data?.message || 'Failed to change password.';

      if (message === 'Current password is incorrect') {
        setCurrentPasswordInvalid(true);
        setPasswordForm((previous) => ({
          ...previous,
          newPassword: '',
          confirmNewPassword: '',
        }));
      }

      setPasswordError(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return <div className="surface-card-soft p-10 text-center text-[#5f6f81]">Loading profile...</div>;
  }

  if (loadError) {
    return <div className="notice-error">{loadError}</div>;
  }

  return (
    <section className="page-shell max-w-6xl">
      <div className="surface-card p-8">
        <p className="page-eyebrow">Account</p>
        <h1 className="title-serif mt-3 text-4xl font-semibold text-[#203245]">My Profile</h1>
        <p className="mt-3 max-w-2xl text-[#6b7280]">
          Update your personal information and account status details.
        </p>
      </div>

      {success && <div className="notice-success">{success}</div>}
      {error && <div className="notice-error">{error}</div>}

      <div className="surface-card p-8">
        <div className="flex flex-wrap gap-3 border-b border-[#ece8e0] pb-5">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'profile'
                ? 'bg-[#163b63] text-white'
                : 'bg-[#f5f2eb] text-[#203245] hover:bg-[#ece7de]'
            }`}
          >
            Profile
          </button>
          {canManageStudents && (
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'students'
                  ? 'bg-[#163b63] text-white'
                  : 'bg-[#f5f2eb] text-[#203245] hover:bg-[#ece7de]'
              }`}
            >
              {isAdmin ? 'Members' : 'Students'}
            </button>
          )}
        </div>

        {activeTab === 'profile' && (
          <>
        <h2 className="text-xl font-semibold text-[#203245]">
          {isEditing ? 'Edit profile' : 'Profile details'}
        </h2>

        {!isEditing && (
          <div className="mt-6 flex flex-col gap-5">
            <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-[#6b7280]">Full name</p>
              <p className="mt-2 text-[#203245]">{profile?.name || '-'}</p>
            </div>
            <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-[#6b7280]">Email</p>
              <p className="mt-2 text-[#203245]">{profile?.email || '-'}</p>
            </div>
            <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-[#6b7280]">Role</p>
              <p className="mt-2 text-[#203245]">{profile?.role || '-'}</p>
            </div>
            <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-[#6b7280]">Membership</p>
              <p className="mt-2 text-[#203245]">{profile?.membershipStatus || '-'}</p>
            </div>
            <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-[#6b7280]">Joined</p>
              <p className="mt-2 text-[#203245]">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-'}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleStartEditing}
                className="button-primary sm:min-w-44"
              >
                Update profile
              </button>
              <button
                type="button"
                onClick={handleDeleteProfile}
                disabled={deleting}
                className="button-secondary border-[#f1c2b5] text-[#9d4a26] hover:bg-[#fff4ef] sm:min-w-44"
              >
                {deleting ? 'Deleting...' : 'Delete profile'}
              </button>
            </div>
          </div>
        )}

        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 flex flex-col gap-5">
            <label className="block">
              <span className="field-label">Full name</span>
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
                className="field-input"
              />
            </label>

            <label className="block">
              <span className="field-label">Email</span>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="field-input"
              />
            </label>

            <label className="block">
              <span className="field-label">Role</span>
              {canEditAccessFields ? (
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="field-select"
                >
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] px-4 py-3 text-[#203245]">
                  {profile?.role || '-'}
                </div>
              )}
            </label>

            <label className="block">
              <span className="field-label">Membership</span>
              {canEditAccessFields ? (
                <select
                  name="membershipStatus"
                  value={formData.membershipStatus}
                  onChange={handleChange}
                  className="field-select"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              ) : (
                <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] px-4 py-3 text-[#203245]">
                  {profile?.membershipStatus || '-'}
                </div>
              )}
            </label>

            <div className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-4">
              <p className="text-sm uppercase tracking-[0.16em] text-[#6b7280]">Joined</p>
              <p className="mt-2 text-[#203245]">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-'}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" disabled={saving} className="button-primary sm:min-w-44">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleCancelEditing}
                className="button-secondary sm:min-w-44"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {canSelfChangePassword && (
          <div className="mt-8 rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-5">
            <h3 className="text-lg font-semibold text-[#203245]">Change password</h3>
            <p className="mt-1 text-sm text-[#6b7280]">
              Update your login password. Confirm the new password before saving.
            </p>

            <form onSubmit={handleChangePassword} className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="field-label">Current password</span>
                <input
                  name="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordFieldChange}
                  required
                  className="field-input"
                />
              </label>

              <label className="block">
                <span className="field-label">New password</span>
                <input
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFieldChange}
                  required
                  minLength={6}
                  disabled={currentPasswordInvalid || !passwordForm.currentPassword.trim()}
                  className="field-input"
                />
              </label>

              <label className="block">
                <span className="field-label">Confirm new password</span>
                <input
                  name="confirmNewPassword"
                  type="password"
                  value={passwordForm.confirmNewPassword}
                  onChange={handlePasswordFieldChange}
                  required
                  minLength={6}
                  disabled={currentPasswordInvalid || !passwordForm.currentPassword.trim()}
                  className="field-input"
                />
              </label>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={passwordSaving || currentPasswordInvalid || !passwordForm.currentPassword.trim()}
                  className="button-primary sm:min-w-44"
                >
                  {passwordSaving ? 'Updating password...' : 'Change password'}
                </button>
                {currentPasswordInvalid && (
                  <p className="mt-2 text-sm text-[#9d4a26]">
                    Current password is incorrect. Enter the correct current password to continue.
                  </p>
                )}
                {passwordError && <div className="notice-error mt-3">{passwordError}</div>}
                {passwordSuccess && <div className="notice-success mt-3">{passwordSuccess}</div>}
              </div>
            </form>
          </div>
        )}
          </>
        )}

        {activeTab === 'students' && canManageStudents && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-[#203245]">
              {isAdmin ? 'Members list' : 'Students list'}
            </h2>
            <p className="mt-2 text-sm text-[#6b7280]">
              {isAdmin
                ? 'View staff and students, then edit or delete their account details.'
                : 'Review all students and update their membership status.'}
            </p>

            {isAdmin && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setAdminMemberTab('students')}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    adminMemberTab === 'students'
                      ? 'bg-[#163b63] text-white'
                      : 'bg-[#f5f2eb] text-[#203245] hover:bg-[#ece7de]'
                  }`}
                >
                  Students
                </button>
                <button
                  type="button"
                  onClick={() => setAdminMemberTab('staff')}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    adminMemberTab === 'staff'
                      ? 'bg-[#163b63] text-white'
                      : 'bg-[#f5f2eb] text-[#203245] hover:bg-[#ece7de]'
                  }`}
                >
                  Staff
                </button>
              </div>
            )}

            {!isAdmin && studentsSuccess && <div className="notice-success mt-5">{studentsSuccess}</div>}
            {!isAdmin && studentsError && <div className="notice-error mt-5">{studentsError}</div>}

            {!isAdmin && studentsLoading ? (
              <div className="surface-card-soft mt-5 p-6 text-center text-[#5f6f81]">
                Loading students...
              </div>
            ) : !isAdmin && students.length === 0 ? (
              <div className="surface-card-soft mt-5 p-6 text-center text-[#5f6f81]">
                No students found.
              </div>
            ) : null}

            {!isAdmin && students.length > 0 && (
              <div className="mt-5 grid gap-4">
                {students.map((student) => {
                  const studentId = student._id || student.id;
                  return (
                    <div
                      key={studentId}
                      className="rounded-2xl border border-[#ece8e0] bg-[#fbfaf8] p-5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-base font-semibold text-[#203245]">{student.name}</p>
                          <p className="text-sm text-[#6b7280]">{student.email}</p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">
                          Joined {new Date(student.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <select
                          value={studentStatuses[studentId] || student.membershipStatus}
                          onChange={(event) =>
                            handleStudentStatusChange(studentId, event.target.value)
                          }
                          className="field-select sm:max-w-xs"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleUpdateStudentMembership(studentId)}
                          disabled={studentSavingId === studentId}
                          className="button-primary sm:min-w-44"
                        >
                          {studentSavingId === studentId ? 'Updating...' : 'Update membership'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isAdmin && membersSuccess && <div className="notice-success mt-5">{membersSuccess}</div>}
            {isAdmin && membersError && <div className="notice-error mt-5">{membersError}</div>}

            {isAdmin && membersLoading ? (
              <div className="surface-card-soft mt-5 p-6 text-center text-[#5f6f81]">
                Loading members...
              </div>
            ) : isAdmin && adminVisibleMembers.length === 0 ? (
              <div className="surface-card-soft mt-5 p-6 text-center text-[#5f6f81]">
                No {adminMemberTab} found.
              </div>
            ) : null}

            {isAdmin && adminVisibleMembers.length > 0 && (
              <div className="mt-5 overflow-x-auto rounded-2xl border border-[#ece8e0] bg-[#fbfaf8]">
                <div className="min-w-215">
                  <div className="grid grid-cols-[1.4fr_1.8fr_0.8fr_1fr_1fr_90px] gap-3 border-b border-[#ece8e0] bg-[#f2eee7] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#58687a]">
                    <span>Name</span>
                    <span>Email</span>
                    <span>Role</span>
                    <span>Membership</span>
                    <span>Joined</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {adminVisibleMembers.map((member) => {
                    const memberId = member._id || member.id;
                    const draft = memberDrafts[memberId] || {
                      name: member.name || '',
                      email: member.email || '',
                      role: (member.role || 'student').toLowerCase(),
                      membershipStatus: member.membershipStatus || 'active',
                      password: '',
                    };
                    const isEditingRow = editingMemberId === memberId;

                    return (
                      <div key={memberId} className="border-b border-[#ece8e0] last:border-b-0">
                        <div className="grid grid-cols-[1.4fr_1.8fr_0.8fr_1fr_1fr_90px] gap-3 px-5 py-4 text-sm text-[#203245]">
                          <span className="truncate">{member.name}</span>
                          <span className="truncate">{member.email}</span>
                          <span className="capitalize">{(member.role || '').toLowerCase()}</span>
                          <span className="capitalize">{member.membershipStatus}</span>
                          <span>{new Date(member.createdAt).toLocaleDateString()}</span>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartMemberEdit(member)}
                              title="Edit member"
                              className="rounded-lg border border-[#d7dee6] p-2 text-[#173b63] transition-colors hover:bg-[#eaf0f6]"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(memberId, member.name)}
                              disabled={memberDeletingId === memberId}
                              title="Delete member"
                              className="rounded-lg border border-[#f1c2b5] p-2 text-[#9d4a26] transition-colors hover:bg-[#fff1eb] disabled:opacity-60"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {isEditingRow && (
                          <div className="border-t border-[#ece8e0] bg-white px-5 py-4">
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              <label className="block">
                                <span className="field-label">Name</span>
                                <input
                                  type="text"
                                  value={draft.name}
                                  onChange={(event) =>
                                    handleMemberDraftChange(memberId, 'name', event.target.value)
                                  }
                                  className="field-input"
                                />
                              </label>
                              <label className="block">
                                <span className="field-label">Email</span>
                                <input
                                  type="email"
                                  value={draft.email}
                                  onChange={(event) =>
                                    handleMemberDraftChange(memberId, 'email', event.target.value)
                                  }
                                  className="field-input"
                                />
                              </label>
                              <label className="block">
                                <span className="field-label">Role</span>
                                <select
                                  value={draft.role}
                                  onChange={(event) =>
                                    handleMemberDraftChange(memberId, 'role', event.target.value)
                                  }
                                  className="field-select"
                                >
                                  <option value="student">Student</option>
                                  <option value="staff">Staff</option>
                                </select>
                              </label>
                              <label className="block">
                                <span className="field-label">Membership</span>
                                <select
                                  value={draft.membershipStatus}
                                  onChange={(event) =>
                                    handleMemberDraftChange(memberId, 'membershipStatus', event.target.value)
                                  }
                                  className="field-select"
                                >
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                  <option value="suspended">Suspended</option>
                                </select>
                              </label>
                              <label className="block md:col-span-2 lg:col-span-2">
                                <span className="field-label">Reset password (optional)</span>
                                <input
                                  type="password"
                                  value={draft.password}
                                  onChange={(event) =>
                                    handleMemberDraftChange(memberId, 'password', event.target.value)
                                  }
                                  placeholder="Enter new password (min 6 chars)"
                                  className="field-input"
                                />
                              </label>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => handleUpdateMember(memberId)}
                                disabled={memberSavingId === memberId}
                                className="button-primary sm:min-w-36"
                              >
                                {memberSavingId === memberId ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelMemberEdit}
                                className="button-secondary sm:min-w-36"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default ProfilePage;
