'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import CreateAccountModal from './CreateAccountModal';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text-light flex relative">
      {/* Ambient background glow elements */}
      <div className="ambient-bg">
        <div className="ambient-blob-1"></div>
        <div className="ambient-blob-2"></div>
      </div>

      {/* Sidebar cố định bên trái */}
      <Sidebar onCreateAccountClick={() => setIsCreateModalOpen(true)} />

      {/* Main Content bên phải */}
      <main className="flex-1 pl-64 min-h-screen flex flex-col transition-all duration-300 relative z-10">
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Modal tạo tài khoản mới */}
      <CreateAccountModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
    </div>
  );
}
