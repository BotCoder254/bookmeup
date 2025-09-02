import React from 'react';
import { Layout } from '../components/layout';
import BookmarkLibrary from '../components/bookmarks/BookmarkLibrary';
import BookmarkTable from '../components/bookmarks/BookmarkTable';
import StatsCards from '../components/dashboard/StatsCards';

const Dashboard = () => {
  return (
    <Layout>
      <DashboardContent />
    </Layout>
  );
};

const DashboardContent = ({ viewMode = 'grid', searchQuery = '', activeView = { type: 'all' } }) => {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="p-6 pb-0">
        <StatsCards />
      </div>
      
      {/* Library */}
      <div className="min-h-0 flex-1">
        {viewMode === 'table' ? (
          <div className="p-6 pt-0">
            <BookmarkTable 
              searchQuery={searchQuery}
              activeView={activeView}
            />
          </div>
        ) : (
          <BookmarkLibrary 
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeView={activeView}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;