import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiStar,
  FiArchive,
  FiExternalLink,
  FiMoreVertical,
  FiEdit,
  FiTrash2,
  FiFolder,
  FiClock,
} from "react-icons/fi";
import {
  useToggleFavorite,
  useToggleArchive,
  useVisitBookmark,
  useDeleteBookmark,
} from "../../hooks";
import {
  formatDate,
  extractDomain,
  getFaviconUrl,
  truncateText,
} from "../../utils";
import { BookmarkDetail } from "./details";

const BookmarkCard = ({ bookmark }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const toggleFavorite = useToggleFavorite();
  const toggleArchive = useToggleArchive();
  const visitBookmark = useVisitBookmark();
  const deleteBookmark = useDeleteBookmark();

  const handleFavoriteToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite.mutate(bookmark.id);
  };

  const handleArchiveToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleArchive.mutate(bookmark.id);
  };

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this bookmark?")) {
      deleteBookmark.mutate(bookmark.id);
    }
  };

  const handleOpenUrl = (e) => {
    e.preventDefault();
    e.stopPropagation();
    visitBookmark.mutate(bookmark.id);
    window.open(bookmark.url, "_blank");
  };

  const handleShowDetail = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
  };

  const domain = extractDomain(bookmark.url);
  const faviconUrl = getFaviconUrl(bookmark.url);

  return (
    <>
      <motion.div
        className="card card-hover group relative"
        whileHover={{ y: -2 }}
        onClick={handleShowDetail}
      >
        {/* Header with favicon and actions */}
        <div className="p-4 pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              {faviconUrl && !imageError ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className="w-6 h-6 rounded"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                  <FiExternalLink className="w-3 h-3 text-gray-500" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {domain}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleFavoriteToggle}
                className={`p-1.5 rounded-md transition-colors ${
                  bookmark.is_favorite
                    ? "text-yellow-500 hover:text-yellow-600"
                    : "text-gray-400 hover:text-yellow-500"
                }`}
              >
                <FiStar
                  className={`w-4 h-4 ${bookmark.is_favorite ? "fill-current" : ""}`}
                />
              </button>
              <button
                onClick={handleOpenUrl}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiExternalLink className="w-4 h-4" />
              </button>

              <div className="relative">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiMoreVertical className="w-4 h-4" />
                </button>

                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10"
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Edit functionality to be implemented
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <FiEdit className="w-4 h-4" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={handleArchiveToggle}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <FiArchive className="w-4 h-4" />
                      <span>
                        {bookmark.is_archived ? "Unarchive" : "Archive"}
                      </span>
                    </button>

                    <button
                      onClick={handleDelete}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
            {bookmark.title || domain}
          </h3>

          {bookmark.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
              {truncateText(bookmark.description, 120)}
            </p>
          )}

          {/* Tags */}
          {bookmark.tags &&
          Array.isArray(bookmark.tags) &&
          bookmark.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 mb-3">
              {bookmark.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  style={{
                    backgroundColor: (tag.color || "#6366f1") + "20",
                    color: tag.color || "#6366f1",
                  }}
                >
                  {tag.name}
                </span>
              ))}
              {bookmark.tags.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  +{bookmark.tags.length - 3}
                </span>
              )}
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              {bookmark.collection_name ? (
                <div className="flex items-center space-x-1">
                  <FiFolder className="w-3 h-3" />
                  <span>{bookmark.collection_name}</span>
                </div>
              ) : bookmark.collection && bookmark.collection.name ? (
                <div className="flex items-center space-x-1">
                  <FiFolder className="w-3 h-3" />
                  <span>{bookmark.collection.name}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center space-x-1">
              <FiClock className="w-3 h-3" />
              <span>{formatDate(bookmark.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Archive indicator */}
        {bookmark.is_archived && (
          <div className="absolute top-2 left-2">
            <FiArchive className="w-4 h-4 text-gray-400" />
          </div>
        )}
      </motion.div>

      {/* Bookmark Detail Panel */}
      <AnimatePresence>
        {showDetail && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <div
              className="absolute inset-0 bg-black bg-opacity-30"
              onClick={handleCloseDetail}
            />
            <div className="relative w-full max-w-2xl">
              <BookmarkDetail
                bookmark={bookmark}
                onClose={handleCloseDetail}
                onEdit={() => {}}
                isMobile={false}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BookmarkCard;
