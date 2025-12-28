import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Use dynamic host based on where the frontend is accessed from
    const getSocketUrl = () => {
      if (import.meta.env.VITE_SOCKET_URL) {
        return import.meta.env.VITE_SOCKET_URL;
      }
      // For production (Azure Container Apps), use same origin
      // For local dev, check if running on localhost with port
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const hostname = window.location.hostname;
      const port = isLocalDev ? ':8080' : '';
      return `${window.location.protocol}//${hostname}${port}`;
    };

    const SOCKET_URL = getSocketUrl();
    const newSocket = io(SOCKET_URL);

    newSocket.on('connect', () => {
    });

    newSocket.on('disconnect', () => {
    });

    setSocket(newSocket);

    // Battery optimization: disconnect socket when page is hidden/backgrounded
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📵 Page hidden - disconnecting socket to save battery');
        newSocket?.disconnect();
      } else {
        console.log('📱 Page visible - reconnecting socket');
        newSocket?.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}
