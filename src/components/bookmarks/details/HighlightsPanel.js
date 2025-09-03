import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { FiBookmark, FiRefreshCw, FiAlertCircle, FiInfo } from "react-icons/fi";
import { apiClient } from "../../../utils/api";
import { BookmarkHighlighter } from "../../../components/highlights";

const HighlightsPanel = ({ bookmarkId }) => {
  const [highlights, setHighlights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const contentRef = useRef(null);

  const fetchHighlights = useCallback(async () => {
    if (!bookmarkId) return;

    setIsLoading(true);
    try {
      const response = await apiClient.getBookmarkHighlights(bookmarkId);
      setHighlights(response.results || []);
    } catch (err) {
      console.error("Error fetching highlights:", err);
      setError("Could not load highlights. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [bookmarkId]);

  const fetchBookmarkContent = useCallback(async () => {
    if (!bookmarkId) return;

    try {
      // Try to get a reader view snapshot first
      const response = await apiClient.getBookmarkSnapshot(bookmarkId);
      if (response && response.html_content) {
        setContent(response.html_content);
        return;
      }
    } catch (err) {
      console.error("Error fetching bookmark snapshot:", err);
      // If snapshot doesn't exist, try to use the bookmark's description
      try {
        const bookmark = await apiClient.getBookmark(bookmarkId);
        if (bookmark.description) {
          setContent(`<div class="p-4">${bookmark.description}</div>`);
        } else {
          setError(
            "No content available to highlight. Try using the Reader View tab first to generate content.",
          );
        }
      } catch (bookmarkErr) {
        console.error("Error fetching bookmark:", bookmarkErr);
        setError("Could not load content for highlighting.");
      }
    }
  }, [bookmarkId]);

  useEffect(() => {
    if (bookmarkId) {
      fetchHighlights();
      fetchBookmarkContent();
    }
  }, [bookmarkId, fetchHighlights, fetchBookmarkContent]);

  const handleHighlightCreated = (newHighlight) => {
    setHighlights((prev) => [...prev, newHighlight]);
  };

  const handleHighlightUpdated = (updatedHighlight) => {
    setHighlights((prev) =>
      prev.map((h) => (h.id === updatedHighlight.id ? updatedHighlight : h)),
    );
  };

  const handleHighlightDeleted = (highlightId) => {
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
  };

  const handleRefresh = () => {
    fetchHighlights();
    fetchBookmarkContent();
  };

  if (isLoading && !content) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin mb-4"></div>
        <div className="text-gray-500 dark:text-gray-400">
          Loading content for highlighting...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <FiAlertCircle className="w-16 h-16 text-red-300 dark:text-red-700 mb-4" />
        <div className="text-red-600 dark:text-red-400 mb-6">{error}</div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium transition-colors flex items-center"
        >
          <FiRefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <FiBookmark className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <div className="text-gray-600 dark:text-gray-400 mb-6">
          No content available for highlighting. Try using the Reader View tab
          first to generate content.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with count and info */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-2 flex justify-between items-center">
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <FiBookmark className="w-4 h-4 mr-2" />
          <span>
            {highlights.length}{" "}
            {highlights.length === 1 ? "highlight" : "highlights"}
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiInfo className="w-4 h-4" />
          </button>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 w-60 bg-white dark:bg-gray-800 rounded-md shadow-lg p-3 z-20 text-sm border border-gray-200 dark:border-gray-700 mt-1"
            >
              <h4 className="font-medium mb-2">How to use highlights:</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400 text-xs">
                <li>• Select text to create a highlight</li>
                <li>• Choose a color from the popup</li>
                <li>• Add optional notes to your highlights</li>
                <li>• Click on existing highlights to edit or delete them</li>
              </ul>
            </motion.div>
          )}
        </div>
      </div>

      {/* Content area with highlighter */}
      <div className="flex-1 overflow-auto p-4 relative">
        <div
          ref={contentRef}
          className="prose dark:prose-invert prose-headings:font-semibold prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-img:rounded-lg prose-img:max-w-full"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Bookmark Highlighter overlay */}
        <BookmarkHighlighter
          bookmarkId={bookmarkId}
          existingHighlights={highlights}
          contentRef={contentRef}
          onHighlightCreated={handleHighlightCreated}
          onHighlightUpdated={handleHighlightUpdated}
          onHighlightDeleted={handleHighlightDeleted}
        />
      </div>
    </div>
  );
};

export default HighlightsPanel;
