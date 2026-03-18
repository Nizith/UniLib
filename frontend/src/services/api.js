import axios from 'axios';

const API_BASE = {
  users: import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3001/api',
  books: import.meta.env.VITE_BOOK_SERVICE_URL || 'http://localhost:3002/api',
  loans: import.meta.env.VITE_LOAN_SERVICE_URL || 'http://localhost:3003/api',
  notifications:
    import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://localhost:3004/api',
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const createRequest = (service) =>
  axios.create({
    baseURL: API_BASE[service],
  });

export const login = async (email, password) => {
  const response = await createRequest('users').post('/users/login', { email, password });
  return response.data;
};

export const register = async (name, email, password, role) => {
  const response = await createRequest('users').post('/users/register', {
    name,
    email,
    password,
    role,
  });
  return response.data;
};

export const getProfile = async () => {
  const response = await createRequest('users').get('/users/profile', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await createRequest('users').put('/users/profile', profileData, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const deleteProfile = async () => {
  const response = await createRequest('users').delete('/users/profile', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const changePassword = async (currentPassword, newPassword, confirmNewPassword) => {
  const response = await createRequest('users').patch(
    '/users/profile/change-password',
    { currentPassword, newPassword, confirmNewPassword },
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};

export const getStudents = async () => {
  const response = await createRequest('users').get('/users/students', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateStudentMembership = async (studentId, membershipStatus) => {
  const response = await createRequest('users').patch(
    `/users/students/${studentId}/membership`,
    { membershipStatus },
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};

export const getManageMembers = async () => {
  const response = await createRequest('users').get('/users/members', {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateManageMember = async (memberId, payload) => {
  const response = await createRequest('users').put(`/users/members/${memberId}`, payload, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const deleteManageMember = async (memberId) => {
  const response = await createRequest('users').delete(`/users/members/${memberId}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const getBooks = async (search = '') => {
  const params = search ? { search } : {};
  const response = await createRequest('books').get('/books', {
    params,
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const getBookById = async (id) => {
  const response = await createRequest('books').get(`/books/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const addBook = async (bookData) => {
  const response = await createRequest('books').post('/books', bookData, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const updateBook = async (id, bookData) => {
  const response = await createRequest('books').put(`/books/${id}`, bookData, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const deleteBook = async (id) => {
  const response = await createRequest('books').delete(`/books/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const borrowBook = async (bookId) => {
  const response = await createRequest('loans').post(
    '/loans/borrow',
    { bookId },
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};

export const returnBook = async (loanId) => {
  const response = await createRequest('loans').post(
    `/loans/return/${loanId}`,
    {},
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};

export const getUserLoans = async () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user?.id) {
    throw new Error('Missing user id');
  }

  const response = await createRequest('loans').get(`/loans/user/${user.id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const getUserNotifications = async () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user?.id) {
    throw new Error('Missing user id');
  }

  const response = await createRequest('notifications').get(`/notifications/user/${user.id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

export const markAsRead = async (notificationId) => {
  const response = await createRequest('notifications').patch(
    `/notifications/${notificationId}/read`,
    {},
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data;
};
