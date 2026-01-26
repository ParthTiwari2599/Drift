"use client";

import React from 'react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

export const ConnectionStatus: React.FC = () => {
  const isOnline = useConnectionStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
      <span className="text-sm font-medium">Connection lost. Trying to reconnect...</span>
    </div>
  );
};