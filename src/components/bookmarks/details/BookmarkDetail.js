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
  FiCopy as FiDuplicate,
  FiMoreHorizontal,
  FiBookOpen,
  FiInfo,
  FiFileText,
  FiChevronLeft,
  FiArrowLeft,
  FiLink,
  FiPieChart,
} from "react-icons/fi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/Tabs";
import { useToast } from "../../../contexts";
import {
  useVisitBookmark,
  useToggleFavorite,
  useToggleArchive,
  useDeleteBookmark,
  useUpdateBookmark,
  useDuplicateBookmark,
} from "../../../hooks";
import { bookmarkKeys } from "../../../hooks/useBookmarks";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../utils/api";
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
  const isDuplicate = bookmark.url.includes("_dup=");
  const originalId = isDuplicate
    ? new URLSearchParams(new URL(bookmark.url).search).get("_dup_from")
    : null;

  const toggleFavorite = useToggleFavorite();
  const toggleArchive = useToggleArchive();
  const visitBookmark = useVisitBookmark();
  const deleteBookmark = useDeleteBookmark();
  const updateBookmark = useUpdateBookmark();
  const duplicateBookmark = useDuplicateBookmark();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Custom function to mark bookmark as read without showing a toast
  const markAsReadSilently = React.useCallback(
    async (bookmarkId) => {
      if (!bookmarkId) return;

      try {
        // Direct API call without toast notifications
        await apiClient.updateBookmark(bookmarkId, { is_read: true });

        // Manually update the cache to reflect changes
        queryClient.invalidateQueries({
          queryKey: bookmarkKeys.detail(bookmarkId),
        });
      } catch (err) {
        console.error("Failed to mark bookmark as read:", err);
      }
    },
    [queryClient],
  );

  // Mark as read once when first rendered with valid bookmark
  useEffect(() => {
    if (bookmark && !bookmark.is_read) {
      markAsReadSilently(bookmark.id);
    }
  }, [bookmark, markAsReadSilently]);

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

  const handleCopyLink = (e) => {
    e && e.preventDefault();
    e && e.stopPropagation();
    navigator.clipboard
      .writeText(bookmark.url)
      .then(() => {
        showToast({
          type: "success",
          title: "Success",
          message: "URL copied to clipboard",
        });
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  const handleShare = (e) => {
    e && e.preventDefault();
    e && e.stopPropagation();
    if (navigator.share) {
      navigator
        .share({
          title: bookmark.title,
          text: bookmark.description,
          url: bookmark.url,
        })
        .catch((err) => {
          console.error("Share failed:", err);
          // Fall back to copy if sharing fails
          handleCopyLink();
        });
    } else {
      showToast({
        type: "info",
        title: "Info",
        message: "Sharing not supported - URL copied to clipboard",
      });

      handleCopyLink();
    }
  };

  const handleDuplicateBookmark = () => {
    duplicateBookmark.mutate(bookmark.id, {
      onSuccess: () => {
        showToast({
          type: "success",
          title: "Success",
          message: "Bookmark duplicated successfully",
        });
        setIsMenuOpen(false);
      },
      onError: (error) => {
        console.error("Failed to duplicate bookmark:", error);
        showToast({
          type: "error",
          title: "Error",
          message: "Failed to duplicate bookmark",
        });
      },
    });
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
          <div className="flex items-center">
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 mr-2"
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>
            {isDuplicate && (
              <span
                className="ml-3 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium flex items-center"
                title="This bookmark is a duplicate"
              >
                <FiCopy className="w-3 h-3 mr-1" />
                Duplicate{" "}
                {originalId
                  ? `(from ID: ${originalId.substring(0, 8)}...)`
                  : ""}
              </span>
            )}
          </div>
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
              onClick={(e) => handleShare(e)}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Share"
              title="Share this bookmark"
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopyLink(e);
                        setIsMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
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
                    <button
                      onClick={handleDuplicateBookmark}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                    >
                      <FiDuplicate className="mr-2 w-4 h-4" />
                      Duplicate bookmark
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
            <div className="flex items-center">
              <button
                onClick={onClose}
                className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center"
              >
                <FiChevronLeft className="w-5 h-5 mr-1" />
                <span className="text-sm font-medium">Back to list</span>
              </button>
              {isDuplicate && (
                <span
                  className="ml-3 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium flex items-center"
                  title="This bookmark is a duplicate"
                >
                  <FiCopy className="w-3 h-3 mr-1" />
                  Duplicate{" "}
                  {originalId
                    ? `(from ID: ${originalId.substring(0, 8)}...)`
                    : ""}
                </span>
              )}
            </div>
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
                onClick={(e) => handleCopyLink(e)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Copy link"
                title="Copy link to clipboard"
              >
                <FiCopy className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => handleShare(e)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Share"
                title="Share this bookmark"
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
                <TabsTrigger
                  value="analytics"
                  className="flex-1 py-3 px-4 text-sm font-medium"
                >
                  <FiPieChart className="w-4 h-4 mr-2" />
                  Analytics
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

              <TabsContent value="analytics" className="p-4 h-full">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Bookmark Analytics
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    View analytics and insights for this bookmark and your
                    entire collection.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <a
                      href="/analytics"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = "/analytics";
                      }}
                      className="inline-flex items-center px-3 py-2 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-sm font-medium"
                    >
                      <FiPieChart className="w-4 h-4 mr-2" />
                      Open Analytics Dashboard
                    </a>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </motion.div>
  );
};

export default BookmarkDetail;
