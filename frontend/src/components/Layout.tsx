import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import UserMenu from './UserMenu';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-[#050505] text-[#f5f5f5] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-10 py-10 space-y-10 bg-transparent">
        <div className="flex justify-end">
          <UserMenu />
        </div>
        {children}
      </main>
    </div>
  );
}
