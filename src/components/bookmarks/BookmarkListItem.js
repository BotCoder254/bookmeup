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
  FiAlertCircle,
  FiCheckCircle,
  FiRotateCw,
  FiLink,
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

const BookmarkListItem = ({ bookmark }) => {
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
        className="card card-hover p-4 cursor-pointer group"
        whileHover={{ x: 4 }}
        onClick={handleShowDetail}
      >
        <div className="flex items-center space-x-4">
          {/* Favicon */}
          <div className="flex-shrink-0">
            {faviconUrl && !imageError ? (
              <img
                src={faviconUrl}
                alt=""
                className="w-8 h-8 rounded"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                <FiExternalLink className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {bookmark.title || domain}
                </h3>

                <div className="flex items-center space-x-2 mt-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {domain}
                  </p>

                  {bookmark.collection_name ? (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">
                        •
                      </span>
                      <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                        <FiFolder className="w-3 h-3" />
                        <span className="truncate">
                          {bookmark.collection_name}
                        </span>
                      </div>
                    </>
                  ) : bookmark.collection && bookmark.collection.name ? (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">
                        •
                      </span>
                      <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                        <FiFolder className="w-3 h-3" />
                        <span className="truncate">
                          {bookmark.collection.name}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>

                {bookmark.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                    {truncateText(bookmark.description, 200)}
                  </p>
                )}

                {/* Tags */}
                {bookmark.tags &&
                  Array.isArray(bookmark.tags) &&
                  bookmark.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {bookmark.tags.slice(0, 5).map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                          style={{
                            backgroundColor: (tag.color || "#6366f1") + "20",
                            color: tag.color || "#6366f1",
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {bookmark.tags.length > 5 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          +{bookmark.tags.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                {/* Link Health Indicator */}
                {bookmark.health_status && (
                  <div className="flex items-center mt-2">
                    {renderHealthIndicator(bookmark.health_status)}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 ml-4">
                {/* Archive indicator */}
                {bookmark.is_archived && (
                  <FiArchive className="w-4 h-4 text-gray-400" />
                )}

                {/* Favorite button */}
                <button
                  onClick={handleFavoriteToggle}
                  className={`p-2 rounded-md transition-colors ${
                    bookmark.is_favorite
                      ? "text-yellow-500 hover:text-yellow-600"
                      : "text-gray-400 hover:text-yellow-500 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <FiStar
                    className={`w-4 h-4 ${bookmark.is_favorite ? "fill-current" : ""}`}
                  />
                </button>

                {/* External Link button */}
                <button
                  onClick={handleOpenUrl}
                  className="p-2 rounded-md text-gray-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <FiExternalLink className="w-4 h-4" />
                </button>

                {/* Menu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    className="p-2 rounded-md text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <FiMoreVertical className="w-4 h-4" />
                  </button>

                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute right-0 top-10 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10"
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

                {/* Date */}
                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                  <FiClock className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">
                    {formatDate(bookmark.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
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

// Helper function to render health status indicator
const renderHealthIndicator = (healthStatus) => {
  let icon = null;
  let label = "";
  let colorClass = "";

  switch (healthStatus.status) {
    case "ok":
      icon = <FiCheckCircle className="w-3 h-3" />;
      label = "Link is healthy";
      colorClass = "text-green-500";
      break;
    case "redirected":
      icon = <FiRotateCw className="w-3 h-3" />;
      label = "Link is redirected";
      colorClass = "text-yellow-500";
      break;
    case "broken":
      icon = <FiAlertCircle className="w-3 h-3" />;
      label = "Link is broken";
      colorClass = "text-red-500";
      break;
    case "archived":
      icon = <FiLink className="w-3 h-3" />;
      label = "Archive available";
      colorClass = "text-blue-500";
      break;
    default:
      return null;
  }

  return (
    <div className={`flex items-center text-xs ${colorClass}`} title={label}>
      {icon}
      <span className="ml-1">{label}</span>
      {healthStatus.has_archive && healthStatus.archive_url && (
        <a
          href={healthStatus.archive_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-blue-500 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View Archive
        </a>
      )}
    </div>
  );
};

export default BookmarkListItem;
