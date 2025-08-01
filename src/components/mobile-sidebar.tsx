'use client';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-xl">
        <div className="p-4">
          <button onClick={onClose} className="mb-4">Close</button>
          <p>Mobile sidebar content</p>
        </div>
      </div>
    </div>
  );
}