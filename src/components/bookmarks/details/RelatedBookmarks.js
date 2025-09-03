import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiLink, FiTag, FiExternalLink } from "react-icons/fi";
import { apiClient, extractDomain, getFaviconUrl } from "../../../utils/api";

const RelatedBookmarks = ({ bookmarkId, domain, tags = [] }) => {
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (bookmarkId && (domain || tags.length > 0)) {
      fetchRelatedBookmarks();
    }
  }, [bookmarkId, domain]);

  const fetchRelatedBookmarks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the getRelatedBookmarks method from apiClient
      const response = await apiClient.getRelatedBookmarks(bookmarkId);
      setBookmarks(response.results || []);
    } catch (err) {
      console.error("Error fetching related bookmarks:", err);
      setError("Could not load related bookmarks.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          Related Bookmarks
        </h3>
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-100 dark:bg-gray-800 h-12 rounded-md"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || bookmarks.length === 0) {
    return null; // Don't show section if no related bookmarks
  }

  return (
    <div className="py-2">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
        Related Bookmarks
      </h3>
      <div className="space-y-2">
        {bookmarks.slice(0, 5).map((bookmark) => (
          <RelatedBookmarkItem key={bookmark.id} bookmark={bookmark} />
        ))}
      </div>
    </div>
  );
};

const RelatedBookmarkItem = ({ bookmark }) => {
  const [imageError, setImageError] = useState(false);
  const faviconUrl = getFaviconUrl(bookmark.url);
  const domain = extractDomain(bookmark.url);

  const handleClick = () => {
    // Navigate to the bookmark detail view
    // This would be handled by the parent component or a router
    window.open(bookmark.url, "_blank");
  };

  const renderRelatedReason = () => {
    if (bookmark.related_by === "domain") {
      return (
        <div className="flex items-center text-xs text-gray-500">
          <FiLink className="w-3 h-3 mr-1" />
          <span>Same domain</span>
        </div>
      );
    } else if (bookmark.related_by === "tags") {
      return (
        <div className="flex items-center text-xs text-gray-500">
          <FiTag className="w-3 h-3 mr-1" />
          <span>{bookmark.shared_tags_count} shared tags</span>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="flex items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
      onClick={handleClick}
    >
      <div className="mr-3">
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
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {bookmark.title}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {domain}
          </div>
          {renderRelatedReason()}
        </div>
      </div>
    </motion.div>
  );
};

export default RelatedBookmarks;
