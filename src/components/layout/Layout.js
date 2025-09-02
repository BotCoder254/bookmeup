import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import FloatingActionButton from '../ui/FloatingActionButton';
import QuickAddModal from '../modals/QuickAddModal';

const Layout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const location = useLocation();

  // Determine active view based on current route
  const getActiveView = () => {
    if (location.pathname === '/favorites') {
      return { type: 'favorites' };
    } else if (location.pathname === '/archived') {
      return { type: 'archived' };
    } else {
      return { type: 'all' };
    }
  };

  const activeView = getActiveView();

  const handleViewChange = (view, id = null) => {
    // This is now handled by route navigation in the Sidebar component
  };

  const handleAddBookmark = () => {
    setShowQuickAddModal(true);
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddBookmark={handleAddBookmark}
        />

        {/* Page Content */}
        <motion.main
          className="flex-1 overflow-y-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {React.cloneElement(children, {
            viewMode,
            searchQuery,
            activeView,
          })}
        </motion.main>
        
        {/* Floating Action Button */}
        <FloatingActionButton onClick={handleAddBookmark} />
        
        {/* Quick Add Modal */}
        <QuickAddModal 
          isOpen={showQuickAddModal}
          onClose={() => setShowQuickAddModal(false)}
        />
      </div>
    </div>
  );
};

export default Layout;