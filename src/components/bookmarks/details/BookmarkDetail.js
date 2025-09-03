import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiStar,
  FiArchive,
  FiExternalLink,
  FiCopy,
  FiShare2,
  FiEdit2,
  FiTag,
  FiFolder,
  FiClock,
  FiEye,
  FiMoreHorizontal,
  FiBookOpen,
  FiInfo,
  FiFileText,
  FiChevronLeft,
  FiLink,
  FiArrowLeft,
} from "react-icons/fi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/Tabs";
import {
  useToggleFavorite,
  useToggleArchive,
  useVisitBookmark,
  useDeleteBookmark,
  useUpdateBookmark,
} from "../../../hooks";
import {
  formatDate,
  extractDomain,
  getFaviconUrl,
  truncateText,
} from "../../../utils";
import NotesPanel from "./NotesPanel";
import ReaderView from "./ReaderView";
import RelatedBookmarks from "./RelatedBookmarks";
import MetadataPanel from "./MetadataPanel";

const BookmarkDetail = ({ bookmark, onClose, onEdit, isMobile }) => {
  const [activeTab, setActiveTab] = useState("summary");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleFavorite = useToggleFavorite();
  const toggleArchive = useToggleArchive();
  const visitBookmark = useVisitBookmark();
  const deleteBookmark = useDeleteBookmark();
  const updateBookmark = useUpdateBookmark();

  useEffect(() => {
    // Mark as read when opened
    if (bookmark && !bookmark.is_read) {
      updateBookmark.mutate({
        id: bookmark.id,
        is_read: true,
      });
    }
  }, [bookmark?.id]);

  if (!bookmark) return null;

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

  const handleVisit = () => {
    visitBookmark.mutate(bookmark.id);
    window.open(bookmark.url, "_blank");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookmark.url);
    // Show toast notification
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: bookmark.title,
        text: bookmark.description,
        url: bookmark.url,
      });
    } else {
      handleCopyLink();
    }
  };

  const domain = extractDomain(bookmark.url);
  const faviconUrl = getFaviconUrl(bookmark.url);

  // Desktop: Split view with sidebar
  // Mobile: Full-page view with tabs
  return (
    <motion.div
      className={`bg-white dark:bg-gray-900 overflow-hidden ${
        isMobile
          ? "fixed inset-0 z-50"
          : "h-full border-l border-gray-200 dark:border-gray-700"
      }`}
      initial={{ opacity: 0, x: isMobile ? 300 : 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isMobile ? 300 : 400 }}
      transition={{ duration: 0.3 }}
    >
      {/* Mobile Header */}
      {isMobile && (
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex space-x-2">
            <button
              onClick={handleFavoriteToggle}
              className={`p-1.5 rounded-full ${
                bookmark.is_favorite
                  ? "text-yellow-500 hover:text-yellow-600"
                  : "text-gray-400 hover:text-yellow-500"
              }`}
            >
              <FiStar
                className={`w-5 h-5 ${bookmark.is_favorite ? "fill-current" : ""}`}
              />
            </button>
            <button
              onClick={handleArchiveToggle}
              className={`p-1.5 rounded-full ${
                bookmark.is_archived
                  ? "text-blue-500 hover:text-blue-600"
                  : "text-gray-400 hover:text-blue-500"
              }`}
            >
              <FiArchive
                className={`w-5 h-5 ${bookmark.is_archived ? "fill-current" : ""}`}
              />
            </button>
            <button
              onClick={handleShare}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FiShare2 className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiMoreHorizontal className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 z-20"
                  >
                    <button
                      onClick={handleCopyLink}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                    >
                      <FiCopy className="mr-2 w-4 h-4" />
                      Copy link
                    </button>
                    <button
                      onClick={onEdit}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                    >
                      <FiEdit2 className="mr-2 w-4 h-4" />
                      Edit bookmark
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="h-full flex flex-col">
        {/* Desktop header with actions */}
        {!isMobile && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center"
            >
              <FiChevronLeft className="w-5 h-5 mr-1" />
              <span className="text-sm font-medium">Back to list</span>
            </button>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleFavoriteToggle}
                className={`p-1.5 rounded-md transition-colors ${
                  bookmark.is_favorite
                    ? "text-yellow-500 hover:text-yellow-600"
                    : "text-gray-400 hover:text-yellow-500"
                }`}
              >
                <FiStar
                  className={`w-5 h-5 ${bookmark.is_favorite ? "fill-current" : ""}`}
                />
              </button>
              <button
                onClick={handleArchiveToggle}
                className={`p-1.5 rounded-md transition-colors ${
                  bookmark.is_archived
                    ? "text-blue-500 hover:text-blue-600"
                    : "text-gray-400 hover:text-blue-500"
                }`}
              >
                <FiArchive
                  className={`w-5 h-5 ${bookmark.is_archived ? "fill-current" : ""}`}
                />
              </button>
              <button
                onClick={handleVisit}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiExternalLink className="w-5 h-5" />
              </button>
              <button
                onClick={handleCopyLink}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiCopy className="w-5 h-5" />
              </button>
              <button
                onClick={handleShare}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiShare2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area with Tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs
            defaultValue="summary"
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-col"
          >
            {/* Tab Bar */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <TabsList className="flex">
                <TabsTrigger
                  value="summary"
                  className="flex-1 py-3 px-4 text-sm font-medium"
                >
                  <FiInfo className="w-4 h-4 mr-2" />
                  Summary
                </TabsTrigger>
                <TabsTrigger
                  value="reader"
                  className="flex-1 py-3 px-4 text-sm font-medium"
                >
                  <FiBookOpen className="w-4 h-4 mr-2" />
                  Reader
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="flex-1 py-3 px-4 text-sm font-medium"
                >
                  <FiFileText className="w-4 h-4 mr-2" />
                  Notes
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto">
              <TabsContent value="summary" className="p-4 h-full">
                <div className="space-y-6">
                  {/* Bookmark title and domain */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {faviconUrl ? (
                        <img
                          src={faviconUrl}
                          alt=""
                          className="w-5 h-5 rounded"
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      ) : (
                        <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                          <FiLink className="w-3 h-3 text-gray-500" />
                        </div>
                      )}
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 dark:text-gray-400 hover:underline truncate"
                      >
                        {domain}
                      </a>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                      {bookmark.title}
                    </h1>
                  </div>

                  {/* Description */}
                  {bookmark.description && (
                    <div className="py-2">
                      <p className="text-gray-700 dark:text-gray-300">
                        {bookmark.description}
                      </p>
                    </div>
                  )}

                  {/* Screenshot preview */}
                  {bookmark.screenshot_url && (
                    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      <img
                        src={bookmark.screenshot_url}
                        alt="Page preview"
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Tags */}
                  {bookmark.tags && bookmark.tags.length > 0 && (
                    <div className="py-2">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center">
                        <FiTag className="w-4 h-4 mr-1" />
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {bookmark.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: (tag.color || "#6366f1") + "20",
                              color: tag.color || "#6366f1",
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <MetadataPanel bookmark={bookmark} />

                  {/* Related Bookmarks */}
                  <RelatedBookmarks
                    bookmarkId={bookmark.id}
                    domain={domain}
                    tags={bookmark.tags || []}
                  />
                </div>
              </TabsContent>

              <TabsContent value="reader" className="h-full">
                <ReaderView bookmarkId={bookmark.id} url={bookmark.url} />
              </TabsContent>

              <TabsContent value="notes" className="p-4 h-full">
                <NotesPanel bookmarkId={bookmark.id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </motion.div>
  );
};

export default BookmarkDetail;
