import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

const socketUrlFromEnv = import.meta.env.VITE_NOTIFICATION_SOCKET_URL;

const getSocketUrl = () => {
  if (socketUrlFromEnv !== undefined && socketUrlFromEnv !== '') {
    return socketUrlFromEnv;
  }
  return undefined;
};

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const url = getSocketUrl();
    const opts = { transports: ['websocket', 'polling'] };
    const newSocket = url ? io(url, opts) : io(opts);

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('register', user.id);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
