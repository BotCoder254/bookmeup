import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useInfiniteBookmarks, useBookmarks } from "../../hooks";
import BookmarkCard from "./BookmarkCard";
import BookmarkListItem from "./BookmarkListItem";
import LoadingSpinner from "../LoadingSpinner";
import { FiGrid, FiList, FiLayout } from "react-icons/fi";
import { BoardView } from "./board";

const BookmarkLibrary = ({
  viewMode = "grid",
  searchQuery = "",
  activeView = { type: "all" },
  className = "",
}) => {
  const isVisualBoardEnabled =
    activeView?.type === "collection" && activeView?.id;
  // Build filters based on active view
  const filters = useMemo(() => {
    const newFilters = {};

    if (searchQuery) {
      newFilters.search = searchQuery;
    }

    if (activeView?.type === "favorites") {
      newFilters.is_favorite = true;
    } else if (activeView?.type === "archived") {
      newFilters.is_archived = true;
    } else if (activeView?.type === "collection" && activeView?.id) {
      newFilters.collection = activeView.id;
    } else if (activeView?.type === "tag" && activeView?.id) {
      newFilters.tags = [activeView.id];
    }

    return newFilters;
  }, [searchQuery, activeView]);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteBookmarks(filters);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  // Fetch next page when sentinel comes into view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages into a single array
  const bookmarks = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.results || []);
  }, [data]);

  const handleKeyNavigation = (e) => {
    // Keyboard navigation (J/K to move, Enter to open)
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      // Move to next bookmark
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      // Move to previous bookmark
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Open current bookmark
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyNavigation);
    return () => {
      document.removeEventListener("keydown", handleKeyNavigation);
    };
  }, []);

  if (status === "loading") {
    return (
      <div className={`p-6 ${className}`}>
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              : "space-y-4"
          }
        >
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card p-6">
              <LoadingSpinner size="sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">
            Error loading bookmarks: {error?.message}
          </p>
        </div>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className={`p-6 ${className}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="mb-4">
            {viewMode === "grid" ? (
              <FiGrid className="w-12 h-12 text-gray-400 mx-auto" />
            ) : viewMode === "board" ? (
              <FiLayout className="w-12 h-12 text-gray-400 mx-auto" />
            ) : (
              <FiList className="w-12 h-12 text-gray-400 mx-auto" />
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {searchQuery
              ? "No bookmarks found matching your search."
              : "No bookmarks yet. Add your first one!"}
          </p>
        </motion.div>
      </div>
    );
  }

  // If we're viewing a collection and the viewMode is 'board', use the visual board view
  if (viewMode === "board" && isVisualBoardEnabled) {
    return (
      <div className={className} role="main" aria-label="Visual Bookmark Board">
        <BoardView collection={activeView} activeView={activeView} />
      </div>
    );
  }

  return (
    <div
      className={`p-6 ${className}`}
      role="main"
      aria-label="Bookmark Library"
    >
      {viewMode === "grid" ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
          role="grid"
        >
          {bookmarks.map((bookmark, index) => (
            <motion.div
              key={`${bookmark.id}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (index % 20) * 0.02, duration: 0.3 }}
              role="gridcell"
            >
              <BookmarkCard bookmark={bookmark} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
          role="list"
        >
          {bookmarks.map((bookmark, index) => (
            <motion.div
              key={`${bookmark.id}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (index % 20) * 0.01, duration: 0.3 }}
              role="listitem"
            >
              <BookmarkListItem bookmark={bookmark} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Infinite Scroll Sentinel */}
      <div ref={loadMoreRef} className="flex justify-center pt-8">
        {isFetchingNextPage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center space-x-2"
          >
            <LoadingSpinner size="sm" message="" />
            <span className="text-gray-500 dark:text-gray-400">
              Loading more bookmarks...
            </span>
          </motion.div>
        )}
        {!hasNextPage && bookmarks.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-gray-500 dark:text-gray-400 text-center py-4"
          >
            You've reached the end of your bookmarks!
          </motion.p>
        )}
      </div>
    </div>
  );
};

export default BookmarkLibrary;
