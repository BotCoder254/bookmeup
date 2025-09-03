import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FiExternalLink,
  FiRefreshCw,
  FiBook,
  FiAlertCircle,
  FiBookmark,
} from "react-icons/fi";
import { apiClient } from "../../../utils/api";
import { BookmarkHighlighter } from "../../../components/highlights";

const ReaderView = ({ bookmarkId, url }) => {
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const contentRef = useRef(null);

  const fetchSnapshot = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the getBookmarkSnapshot method from apiClient
      const response = await apiClient.getBookmarkSnapshot(bookmarkId);
      setSnapshot(response);
    } catch (err) {
      console.error("Error fetching snapshot:", err);
      // If snapshot doesn't exist, don't show an error, we'll show the generate button
      if (err.message && err.message.includes("404")) {
        setError(null);
      } else {
        setError("Could not load reader view. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [bookmarkId]);

  const fetchHighlights = useCallback(async () => {
    try {
      const response = await apiClient.getBookmarkHighlights(bookmarkId);
      setHighlights(response.results || []);
    } catch (err) {
      console.error("Error fetching highlights:", err);
    }
  }, [bookmarkId]);

  useEffect(() => {
    if (bookmarkId) {
      fetchSnapshot();
      fetchHighlights();
    }
  }, [bookmarkId, fetchSnapshot, fetchHighlights]);

  const generateSnapshot = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the generateBookmarkSnapshot method from apiClient
      const response = await apiClient.generateBookmarkSnapshot(bookmarkId);
      if (response && response.html_content) {
        setSnapshot(response);
        setError(null);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Error generating snapshot:", err);
      setError("Could not generate reader view. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin mb-4"></div>
        <div className="text-gray-500 dark:text-gray-400">
          {snapshot ? "Refreshing reader view..." : "Preparing reader view..."}
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <FiBook className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <div className="text-gray-600 dark:text-gray-400 mb-6">
          No reader view available yet. Generate one to improve readability.
        </div>
        <div className="space-y-3">
          <button
            onClick={generateSnapshot}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center min-w-[200px]"
            disabled={isLoading}
          >
            <FiRefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Generate Reader View
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium transition-colors flex items-center justify-center min-w-[200px]"
          >
            <FiExternalLink className="w-4 h-4 mr-2" />
            Open Original Page
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <FiAlertCircle className="w-16 h-16 text-red-300 dark:text-red-700 mb-4" />
        <div className="text-red-600 dark:text-red-400 mb-6">{error}</div>
        <div className="space-y-3">
          <button
            onClick={generateSnapshot}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium transition-colors flex items-center min-w-[200px] justify-center"
          >
            <FiRefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium transition-colors flex items-center min-w-[200px] justify-center"
          >
            <FiExternalLink className="w-4 h-4 mr-2" />
            Open Original Page
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Reader Controls */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-2 flex justify-between items-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {snapshot.created_at &&
            `Captured: ${new Date(snapshot.created_at).toLocaleDateString()}`}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={generateSnapshot}
            className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center"
            disabled={isLoading}
          >
            <FiRefreshCw
              className={`w-3 h-3 mr-1 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center"
          >
            <FiExternalLink className="w-3 h-3 mr-1" />
            Original
          </a>
          <div className="flex items-center text-xs px-2 py-1 text-yellow-600 dark:text-yellow-400">
            <FiBookmark className="w-3 h-3 mr-1" />
            <span>{highlights.length} highlights</span>
          </div>
        </div>
      </div>

      {/* Reader Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative">
        <div className="mx-auto max-w-prose">
          {snapshot.html_content ? (
            <>
              <div
                ref={contentRef}
                className="prose dark:prose-invert prose-headings:font-semibold prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-img:rounded-lg prose-img:max-w-full"
                dangerouslySetInnerHTML={{ __html: snapshot.html_content }}
              />
              <BookmarkHighlighter
                bookmarkId={bookmarkId}
                existingHighlights={highlights}
                contentRef={contentRef}
                onHighlightCreated={(highlight) => {
                  setHighlights((prev) => [...prev, highlight]);
                }}
                onHighlightUpdated={(updatedHighlight) => {
                  setHighlights((prev) =>
                    prev.map((h) =>
                      h.id === updatedHighlight.id ? updatedHighlight : h,
                    ),
                  );
                }}
                onHighlightDeleted={(highlightId) => {
                  setHighlights((prev) =>
                    prev.filter((h) => h.id !== highlightId),
                  );
                }}
              />
            </>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-center py-8">
              Content could not be loaded. Try refreshing the reader view.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReaderView;
