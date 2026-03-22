import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const login = async (email, password) => {
  const response = await api.post('/users/login', { email, password });
  return response.data;
};

export const register = async (name, email, password, role) => {
  const response = await api.post('/users/register', {
    name,
    email,
    password,
    role,
  });
  return response.data;
};

export const getUserById = async (userId) => {
  const response = await api.get(`/users/${userId}`);
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get('/users/profile', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await api.put('/users/profile', profileData, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const deleteProfile = async () => {
  const response = await api.delete('/users/profile', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const changePassword = async (currentPassword, newPassword, confirmNewPassword) => {
  const response = await api.patch(
    '/users/profile/change-password',
    { currentPassword, newPassword, confirmNewPassword },
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};

export const getStudents = async () => {
  const response = await api.get('/users/students', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateStudentMembership = async (studentId, membershipStatus) => {
  const response = await api.patch(
    `/users/students/${studentId}/membership`,
    { membershipStatus },
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};

export const getManageMembers = async () => {
  const response = await api.get('/users/members', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateManageMember = async (memberId, payload) => {
  const response = await api.put(`/users/members/${memberId}`, payload, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const deleteManageMember = async (memberId) => {
  const response = await api.delete(`/users/members/${memberId}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const getBooks = async (search = '') => {
  const params = search ? { search } : {};
  const response = await api.get('/books', {
    params,
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const getBookById = async (id) => {
  const response = await api.get(`/books/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const addBook = async (bookData) => {
  const response = await api.post('/books', bookData, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateBook = async (id, bookData) => {
  const response = await api.put(`/books/${id}`, bookData, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const deleteBook = async (id) => {
  const response = await api.delete(`/books/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const borrowBook = async (bookId) => {
  const response = await api.post(
    '/loans/borrow',
    { bookId },
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};

export const returnBook = async (loanId) => {
  const response = await api.post(
    `/loans/return/${loanId}`,
    {},
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};

export const getActiveLoans = async () => {
  const response = await api.get('/loans/active', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const getUserLoans = async () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user?.id) {
    throw new Error('Missing user id');
  }

  const response = await api.get(`/loans/user/${user.id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const getUserNotifications = async () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user?.id) {
    throw new Error('Missing user id');
  }

  const response = await api.get(`/notifications/user/${user.id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const markAsRead = async (notificationId) => {
  const response = await api.patch(
    `/notifications/${notificationId}/read`,
    {},
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};

export const markAllAsRead = async () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user?.id) throw new Error('Missing user id');

  const response = await api.patch(
    `/notifications/user/${user.id}/read-all`,
    {},
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const deleteNotification = async (notificationId) => {
  const response = await api.delete(`/notifications/${notificationId}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const getUnreadCount = async () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user?.id) throw new Error('Missing user id');

  const response = await api.get(`/notifications/user/${user.id}/unread-count`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};
