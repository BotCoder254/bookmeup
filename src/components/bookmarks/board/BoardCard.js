import React, { useRef } from "react";
import { useDrag } from "react-dnd";
import { motion } from "framer-motion";
import {
  FiStar,
  FiArchive,
  FiExternalLink,
  FiMoreVertical,
  FiEdit,
  FiCopy,
} from "react-icons/fi";
import {
  useToggleFavorite,
  useToggleArchive,
  useVisitBookmark,
} from "../../../hooks";
import {
  extractDomain,
  getFaviconUrl,
  truncateText,
} from "../../../utils";
import { BookmarkDetail } from "../details";

const BoardCard = ({ bookmark, draggable = true, onDragStart, onDragEnd, style }) => {
  const [showDetail, setShowDetail] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  const cardRef = useRef(null);

  const toggleFavorite = useToggleFavorite();
  const toggleArchive = useToggleArchive();
  const visitBookmark = useVisitBookmark();

  // Set up drag and drop
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "BOOKMARK_CARD",
    item: { id: bookmark.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: draggable,
    options: {
      dropEffect: "move",
    },
    begin: () => {
      onDragStart && onDragStart();
    },
    end: () => {
      onDragEnd && onDragEnd();
    }
  }), [bookmark.id, draggable, onDragStart, onDragEnd]);

  // Connect drag to the ref
  if (draggable) {
    drag(cardRef);
  }

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

  const handleVisit = (e) => {
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
        ref={cardRef}
        className={`card ${draggable ? 'cursor-grab' : ''} ${isDragging ? 'opacity-50 cursor-grabbing' : ''}`}
        onClick={handleShowDetail}
        style={{
          ...style,
          transition: isDragging ? 'none' : 'all 0.2s ease',
        }}
        whileHover={{ y: draggable ? -2 : 0 }}
      >
        {/* Card header with favicon */}
        <div className="p-3 pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              {faviconUrl && !imageError ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className="w-5 h-5 rounded"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                  <FiExternalLink className="w-3 h-3 text-gray-500" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {domain}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handleFavoriteToggle}
                className={`p-1 rounded-md transition-colors ${
                  bookmark.is_favorite
                    ? "text-yellow-500 hover:text-yellow-600"
                    : "text-gray-400 hover:text-yellow-500"
                }`}
              >
                <FiStar
                  className={`w-3 h-3 ${bookmark.is_favorite ? "fill-current" : ""}`}
                />
              </button>
              <button
                onClick={handleVisit}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Card content */}
        <div className="px-3 pb-3">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2 text-sm">
            {bookmark.title || domain}
          </h3>

          {bookmark.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
              {truncateText(bookmark.description, 100)}
            </p>
          )}

          {/* Tags */}
          {bookmark.tags &&
          Array.isArray(bookmark.tags) &&
          bookmark.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 mb-2">
              {bookmark.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  style={{
                    backgroundColor: (tag.color || "#6366f1") + "20",
                    color: tag.color || "#6366f1",
                  }}
                >
                  {tag.name}
                </span>
              ))}
              {bookmark.tags.length > 2 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  +{bookmark.tags.length - 2}
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* Archive indicator */}
        {bookmark.is_archived && (
          <div className="absolute top-2 left-2">
            <FiArchive className="w-3 h-3 text-gray-400" />
          </div>
        )}
      </motion.div>

      {/* Bookmark Detail Panel */}
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
    </>
  );
};

export default BoardCard;
