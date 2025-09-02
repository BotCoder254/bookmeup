import React from 'react';
import { motion } from 'framer-motion';
import { useBookmarks } from '../../hooks';
import BookmarkListItem from './BookmarkListItem';
import LoadingSpinner from '../LoadingSpinner';

const BookmarkList = ({ searchQuery, activeView }) => {
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
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card p-4">
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
      className="space-y-3"
    >
      {bookmarks.map((bookmark, index) => (
        <motion.div
          key={bookmark.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03, duration: 0.3 }}
        >
          <BookmarkListItem bookmark={bookmark} />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default BookmarkList;