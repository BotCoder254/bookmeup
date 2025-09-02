import React from 'react';
import { motion } from 'framer-motion';
import { useBookmarks } from '../../hooks';
import BookmarkCard from './BookmarkCard';
import LoadingSpinner from '../LoadingSpinner';

const BookmarkGrid = ({ searchQuery, activeView }) => {
  // Build filters based on active view
  const filters = {};
  
  if (searchQuery) {
    filters.search = searchQuery;
  }
  
  if (activeView?.type === 'favorites') {
    filters.is_favorite = true;
  } else if (activeView?.type === 'archived') {
    filters.is_archived = true;
  } else if (activeView?.type === 'collection' && activeView?.id) {
    filters.collection = activeView.id;
  } else if (activeView?.type === 'tag' && activeView?.id) {
    filters.tags = [activeView.id];
  }

  const { data, isLoading, isError, error } = useBookmarks(filters);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="card p-6">
            <LoadingSpinner size="sm" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">
          Error loading bookmarks: {error.message}
        </p>
      </div>
    );
  }

  const bookmarks = data?.results || [];

  if (bookmarks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12"
      >
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          {searchQuery ? 'No bookmarks found matching your search.' : 'No bookmarks yet. Add your first one!'}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {bookmarks.map((bookmark, index) => (
        <motion.div
          key={bookmark.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
        >
          <BookmarkCard bookmark={bookmark} />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default BookmarkGrid;