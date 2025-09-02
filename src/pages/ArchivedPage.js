import React from 'react';
import { Layout } from '../components/layout';
import { BookmarkLibrary } from '../components';

const ArchivedPage = () => {
  return (
    <Layout>
      <ArchivedContent />
    </Layout>
  );
};

const ArchivedContent = ({ viewMode = 'grid', searchQuery = '', activeView = { type: 'archived' } }) => {
  return (
    <div className="space-y-6">
      {/* Library */}
      <div className="min-h-0 flex-1">
        <BookmarkLibrary 
          viewMode={viewMode}
          searchQuery={searchQuery}
          activeView={activeView}
        />
      </div>
    </div>
  );
};

export default ArchivedPage;