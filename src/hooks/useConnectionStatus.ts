"use client";

import { useState, useEffect } from 'react';
import { getConnectionStatus, monitorConnection } from '@/lib/firebase';

export const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(getConnectionStatus());

  useEffect(() => {
    // Start monitoring connection status
    const unsubscribe = monitorConnection((status: boolean) => {
      setIsOnline(status);
    });

    return unsubscribe;
  }, []);

  return isOnline;
};