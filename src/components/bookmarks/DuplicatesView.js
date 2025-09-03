import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCopy,
  FiCheck,
  FiExternalLink,
  FiX,
  FiRefreshCw,
  FiAlertTriangle,
  FiChevronRight,
  FiChevronDown,
  FiLink,
  FiCalendar,
  FiTag,
  FiClipboard,
  FiEdit,
  FiStar,
  FiCheckCircle,
  FiPlus,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
  apiClient,
  truncateText,
  formatDate,
  extractDomain,
} from "../../utils";
import { useToast } from "../../contexts";
import BookmarkCard from "./BookmarkCard";

const DuplicatesView = () => {
  const [loading, setLoading] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [primaryBookmarkId, setPrimaryBookmarkId] = useState(null);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState([]);
  const [merging, setMerging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  // Fetch duplicate bookmarks
  const fetchDuplicates = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      const response = await apiClient.getBookmarkDuplicates();

      // Check response structure to avoid errors
      if (response && response.duplicate_groups) {
        setDuplicateGroups(response.duplicate_groups);
      } else if (response && response.data && response.data.duplicate_groups) {
        setDuplicateGroups(response.data.duplicate_groups);
      } else {
        console.error("Unexpected response format:", response);
        setDuplicateGroups([]);
      }

      // Log the duplicate groups for debugging
      console.log(
        "Duplicate groups:",
        response.duplicate_groups || response.data?.duplicate_groups || [],
      );

      // Initialize expanded groups state
      const initialExpandedState = {};
      const groups =
        response.data?.duplicate_groups || response.duplicate_groups || [];
      groups.forEach((group, index) => {
        initialExpandedState[index] = false;
      });

      setExpandedGroups(initialExpandedState);
    } catch (error) {
      console.error("Error fetching duplicates:", error);
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to fetch duplicate bookmarks",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const toggleGroupExpand = (groupIndex) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupIndex]: !prev[groupIndex],
    }));
  };

  const handleMergeClick = (group, groupIndex) => {
    setSelectedGroup({ ...group, index: groupIndex });

    // Select the first bookmark as primary by default
    if (group.bookmarks && group.bookmarks.length > 0) {
      setPrimaryBookmarkId(group.bookmarks[0].id);

      // Select all other bookmarks to be merged
      const otherBookmarkIds = group.bookmarks
        .slice(1)
        .map((bookmark) => bookmark.id);

      setSelectedBookmarkIds(otherBookmarkIds);
    }

    setShowMergeDialog(true);
  };

  const handlePrimarySelection = (bookmarkId) => {
    // Save the current primary ID to check if it's changing
    const oldPrimaryId = primaryBookmarkId;

    // Set the new primary bookmark
    setPrimaryBookmarkId(bookmarkId);

    // Update selected bookmarks to be everything except the primary
    if (selectedGroup && selectedGroup.bookmarks) {
      // If we're changing the primary bookmark and the old primary exists
      if (oldPrimaryId && oldPrimaryId !== bookmarkId) {
        // Include the old primary in the selection list
        setSelectedBookmarkIds((prev) => {
          const newSelection = [...prev];
          if (!newSelection.includes(oldPrimaryId)) {
            newSelection.push(oldPrimaryId);
          }
          return newSelection.filter((id) => id !== bookmarkId);
        });
      } else {
        // Otherwise just filter out the new primary
        const otherBookmarkIds = selectedGroup.bookmarks
          .filter((bookmark) => bookmark.id !== bookmarkId)
          .map((bookmark) => bookmark.id);

        // When selecting a primary bookmark, automatically select all other bookmarks as duplicates
        const uniqueOtherIds = [...new Set(otherBookmarkIds)];
        setSelectedBookmarkIds(uniqueOtherIds);
      }
    }

    // Show a toast to confirm the selection
    showToast({
      type: "info",
      title: "Primary Selected",
      message: "Primary bookmark selected for merging",
      duration: 2000,
    });
  };

  const toggleBookmarkSelection = (bookmarkId) => {
    if (bookmarkId === primaryBookmarkId) {
      // If clicking on the primary bookmark, show an info message
      showToast({
        type: "info",
        title: "Primary Bookmark",
        message:
          "This is your primary bookmark that will be kept after merging",
        duration: 2000,
      });

      // Log for debugging
      console.log("Primary bookmark selected:", bookmarkId);
      console.log("Current selection:", {
        primaryId: primaryBookmarkId,
        selectedIds: selectedBookmarkIds,
      });
      return;
    }

    if (primaryBookmarkId === null) {
      // If no primary bookmark is selected, make this one the primary
      setPrimaryBookmarkId(bookmarkId);
      showToast({
        type: "success",
        title: "Primary Selected",
        message:
          "Primary bookmark set. Now select duplicates to merge by clicking the + button on each bookmark.",
        duration: 3000,
      });
      return;
    }

    setSelectedBookmarkIds((prev) => {
      if (prev.includes(bookmarkId)) {
        return prev.filter((id) => id !== bookmarkId);
      } else {
        // Make sure we don't add the primary bookmark to the selected list
        if (bookmarkId !== primaryBookmarkId) {
          return [...prev, bookmarkId];
        }
        return prev;
      }
    });
  };

  const handleMergeConfirm = async () => {
    if (!primaryBookmarkId || selectedBookmarkIds.length === 0) {
      showToast({
        type: "error",
        title: "Error",
        message: "Please select bookmarks to merge",
      });
      return;
    }

    try {
      setMerging(true);

      // Make sure we have a primary ID
      if (!primaryBookmarkId) {
        showToast({
          type: "warning",
          title: "Selection Required",
          message: "Please select a primary bookmark",
          duration: 3000,
        });
        setMerging(false);
        return;
      }

      // Reset selection if somehow the primary is in the selectedBookmarkIds
      if (selectedBookmarkIds.includes(primaryBookmarkId)) {
        setSelectedBookmarkIds(
          selectedBookmarkIds.filter((id) => id !== primaryBookmarkId),
        );
      }

      // Filter out primary ID from selected IDs just to be safe
      // Ensure IDs are strings for consistent comparison
      const primaryIdStr = String(primaryBookmarkId);
      const filteredDuplicateIds = selectedBookmarkIds
        .map((id) => String(id))
        .filter((id) => id !== primaryIdStr);

      console.log("Primary ID:", primaryIdStr);
      console.log("Selected IDs before filtering:", selectedBookmarkIds);
      console.log("Filtered IDs after removing primary:", filteredDuplicateIds);

      // No need to manually update counter - React will handle this
      // Just ensure we have the correct state
      console.log(
        "Final filtered duplicates count:",
        filteredDuplicateIds.length,
      );

      if (filteredDuplicateIds.length === 0) {
        showToast({
          type: "error",
          title: "No Duplicates Selected",
          message:
            "Please select at least one duplicate to merge by clicking the + button on bookmarks",
          duration: 3000,
        });
        setMerging(false);
        return;
      }

      // Log what we're about to merge
      console.log(
        "Merging primary:",
        primaryBookmarkId,
        "with duplicates:",
        filteredDuplicateIds,
      );

      // Show a confirmation message
      showToast({
        type: "info",
        title: "Merging Bookmarks",
        message: `Merging ${filteredDuplicateIds.length} bookmarks into the primary bookmark`,
        duration: 2000,
      });

      try {
        console.log(
          "Making API request with:",
          primaryBookmarkId,
          filteredDuplicateIds,
        );
        await apiClient.mergeBookmarks(primaryBookmarkId, filteredDuplicateIds);
      } catch (apiError) {
        console.error("API error details:", apiError);
        throw apiError;
      }

      // Close the dialog
      setShowMergeDialog(false);

      // Show success message
      showToast({
        type: "success",
        title: "Success",
        message: `Successfully merged ${selectedBookmarkIds.length} bookmarks`,
        action: {
          label: "Undo",
          onClick: () => {
            // Undo functionality would need to be implemented in the backend
            showToast({
              type: "info",
              title: "Info",
              message: "Undo functionality not implemented yet",
            });
          },
        },
      });

      // Refresh duplicates list
      fetchDuplicates();
    } catch (error) {
      console.error("Error merging bookmarks:", error);
      showToast({
        type: "error",
        title: "Error",
        message:
          error.response?.data?.error ||
          error.message ||
          "Failed to merge bookmarks",
      });
    } finally {
      setMerging(false);
    }
  };

  const cancelMerge = () => {
    setShowMergeDialog(false);
    setSelectedGroup(null);
    setPrimaryBookmarkId(null);
    setSelectedBookmarkIds([]);
  };

  const renderDuplicateGroup = (group, index) => {
    const isExpanded = expandedGroups[index];
    const bookmarks = group.bookmarks || [];

    // Sort bookmarks by created date (newest first)
    const sortedBookmarks = [...bookmarks].sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Check for duplicated bookmarks (with _dup parameter)
    const hasDuplicates = sortedBookmarks.some(
      (bookmark) => bookmark.url && bookmark.url.includes("_dup="),
    );

    // Determine group type label
    let groupTypeLabel = "Duplicate URLs";
    if (group.type === "title_similar") {
      groupTypeLabel = "Similar Titles";
    } else if (hasDuplicates) {
      groupTypeLabel = "Duplicated Bookmarks";
    }

    return (
      <div
        key={index}
        className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
      >
        {/* Group header */}
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={() => toggleGroupExpand(index)}
              className="mr-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {isExpanded ? (
                <FiChevronDown className="w-5 h-5" />
              ) : (
                <FiChevronRight className="w-5 h-5" />
              )}
            </button>

            <div>
              <div className="text-sm font-medium flex items-center">
                {group.type === "url_duplicate" ? (
                  hasDuplicates ? (
                    <FiCopy className="mr-2" />
                  ) : (
                    <FiLink className="mr-2" />
                  )
                ) : (
                  <FiClipboard className="mr-2" />
                )}
                <span>{groupTypeLabel}</span>
                <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 rounded-full text-xs">
                  {bookmarks.length} bookmarks
                </span>
              </div>

              {group.normalized_url && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {truncateText(group.normalized_url, 70)}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => handleMergeClick(group, index)}
            className="px-3 py-1.5 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-300 rounded-md text-sm font-medium flex items-center transition-colors"
          >
            <FiCopy className="mr-1.5 w-4 h-4" />
            Merge
          </button>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedBookmarks.map((bookmark) => (
                  <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderBookmarkForMerge = (bookmark) => {
    const isPrimary = primaryBookmarkId === bookmark.id;
    // Allow selection status for all bookmarks
    const isSelected = selectedBookmarkIds.includes(bookmark.id);

    return (
      <div
        key={bookmark.id}
        className={`p-4 border rounded-lg mb-3 ${
          isPrimary
            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
            : isSelected
              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
              : "border-gray-200 dark:border-gray-700"
        }`}
        style={{ cursor: "pointer" }}
        title={
          isPrimary
            ? "Primary bookmark"
            : isSelected
              ? "Selected for merging"
              : "Bookmark"
        }
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              {truncateText(bookmark.title || extractDomain(bookmark.url), 60)}
              {bookmark.url && bookmark.url.includes("_dup=") && (
                <span className="ml-2 text-xs font-medium text-blue-500 dark:text-blue-400 inline-flex items-center">
                  <FiCopy className="w-3 h-3 mr-0.5" /> Duplicate
                </span>
              )}
            </h4>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {extractDomain(bookmark.url)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isPrimary ? (
              <div className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 rounded text-xs font-medium flex items-center whitespace-nowrap">
                <FiStar className="w-3 h-3 mr-1 text-yellow-500" /> Primary
                <span className="ml-1 px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs">
                  Keep
                </span>
              </div>
            ) : (
              <button
                onClick={() => handlePrimarySelection(bookmark.id)}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 font-medium transition-colors flex items-center whitespace-nowrap"
              >
                <FiStar className="w-3 h-3 mr-1 text-primary-500" /> Make
                Primary
              </button>
            )}

            {isSelected && !isPrimary && (
              <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 rounded text-xs font-medium flex items-center whitespace-nowrap">
                <FiCheckCircle className="w-3 h-3 mr-1" /> To Merge
              </div>
            )}

            <button
              onClick={() => toggleBookmarkSelection(bookmark.id)}
              className={`p-1.5 rounded-md border ${
                isSelected
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300"
                  : isPrimary
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300"
                    : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              title={
                isPrimary
                  ? "Primary bookmark"
                  : isSelected
                    ? "Selected for merging"
                    : "Select for merging"
              }
            >
              {isPrimary ? (
                <FiStar className="w-4 h-4" />
              ) : isSelected ? (
                <FiCheck className="w-4 h-4" />
              ) : (
                <FiPlus className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-800 dark:text-gray-200 mb-2">
          <div className="line-clamp-1 text-xs font-mono text-gray-500 dark:text-gray-400 mb-1">
            {bookmark.url}
          </div>

          {bookmark.description && (
            <p className="line-clamp-2 text-gray-600 dark:text-gray-400 mb-1">
              {bookmark.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-1">
          {bookmark.tags &&
            bookmark.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: (tag.color || "#6366f1") + "20",
                  color: tag.color || "#6366f1",
                }}
              >
                {tag.name}
              </span>
            ))}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
          <div className="flex items-center">
            <FiCalendar className="w-3 h-3 mr-1" />
            {formatDate(bookmark.created_at)}
          </div>

          {bookmark.is_favorite && (
            <div className="text-yellow-500 font-medium">Favorite</div>
          )}
        </div>
      </div>
    );
  };

  // Memoize the duplicate groups rendering
  const duplicateGroupElements = useMemo(() => {
    if (duplicateGroups.length === 0) {
      return (
        <div className="text-center py-12">
          <FiCheck className="w-12 h-12 mx-auto text-green-500 mb-3" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No duplicates found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Great job keeping your bookmarks organized! No duplicate URLs or
            similar titles were detected.
          </p>
        </div>
      );
    }

    return duplicateGroups.map((group, index) =>
      renderDuplicateGroup(group, index),
    );
  }, [duplicateGroups, expandedGroups]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Duplicate Bookmarks
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Detect and merge duplicate bookmarks to keep your library organized
          </p>
        </div>

        <button
          onClick={() => fetchDuplicates(true)}
          disabled={refreshing}
          className={`px-4 py-2 rounded-lg flex items-center ${
            refreshing
              ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
          }`}
        >
          <FiRefreshCw
            className={`mr-2 w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">
            Searching for duplicates...
          </p>
        </div>
      ) : (
        <>
          {/* Duplicate groups */}
          <div className="mb-6">{duplicateGroupElements}</div>

          {/* Info box */}
          {duplicateGroups.length > 0 && (
            <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 p-4 flex items-start space-x-3 mb-6">
              <FiAlertTriangle className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                  About duplicate detection
                </h3>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Duplicates are detected by normalizing URLs (removing tracking
                  parameters and standardizing formats) and by comparing title
                  similarity. When merging, you can select which bookmark to
                  keep as the primary and which data to merge.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Merge Dialog */}
      {showMergeDialog && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Dialog header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Merge Duplicate Bookmarks
              </h2>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2 mb-3">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium flex flex-wrap items-center gap-x-2">
                  <span>
                    <span className="font-bold">Primary:</span>{" "}
                    {primaryBookmarkId ? "1 Selected" : "None"}
                  </span>
                  <span className="text-gray-400">|</span>
                  <span>
                    <span className="font-bold">Duplicates:</span>{" "}
                    <span id="selected-count">
                      {primaryBookmarkId && selectedBookmarkIds
                        ? selectedBookmarkIds.filter(
                            (id) => String(id) !== String(primaryBookmarkId),
                          ).length
                        : 0}
                    </span>{" "}
                    Selected
                  </span>
                </p>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2 border border-gray-200 dark:border-gray-700 rounded p-2 bg-gray-50 dark:bg-gray-800">
                <p className="mb-1 flex items-center">
                  <span className="w-5 h-5 inline-flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300 mr-1">
                    1
                  </span>
                  Select primary bookmark
                  <FiStar className="inline-block w-3 h-3 text-yellow-500 mx-1" />
                </p>
                <p className="mb-1 flex items-center">
                  <span className="w-5 h-5 inline-flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300 mr-1">
                    2
                  </span>
                  Select duplicates to merge
                  <FiPlus className="inline-block w-3 h-3 text-gray-500 mx-1" />
                </p>
                <p className="flex items-center">
                  <span className="w-5 h-5 inline-flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300 mr-1">
                    3
                  </span>
                  Click Merge button
                </p>
              </div>
              <button
                onClick={cancelMerge}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Dialog content */}
            <div className="px-6 py-4 overflow-y-auto">
              <div className="mb-4">
                <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                  <p className="mb-2">
                    Select the primary bookmark to keep and the duplicates to
                    merge.
                  </p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    <li>Tags from all bookmarks will be combined</li>
                    <li>Notes from the selected bookmarks will be merged</li>
                    <li>The earliest creation date will be kept</li>
                    <li>
                      Favorites status will be preserved if any bookmark is
                      favorited
                    </li>
                  </ul>
                </div>

                <div className="mt-4 space-y-1">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                    Select primary bookmark and duplicates to merge:
                  </h3>

                  {selectedGroup.bookmarks &&
                    selectedGroup.bookmarks.map((bookmark) =>
                      renderBookmarkForMerge(bookmark),
                    )}
                </div>
              </div>
            </div>

            {/* Dialog footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={cancelMerge}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeConfirm}
                disabled={merging || selectedBookmarkIds.length === 0}
                className={`px-4 py-2 rounded-lg flex items-center font-medium ${
                  merging || selectedBookmarkIds.length === 0
                    ? "bg-primary-400 text-white cursor-not-allowed"
                    : "bg-primary-500 hover:bg-primary-600 text-white"
                }`}
              >
                {merging ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Merging...
                  </>
                ) : (
                  <>
                    <FiCopy className="mr-2" />
                    Merge{" "}
                    <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs font-bold min-w-[18px] inline-block text-center">
                      {primaryBookmarkId && selectedBookmarkIds
                        ? selectedBookmarkIds.filter(
                            (id) => String(id) !== String(primaryBookmarkId),
                          ).length
                        : 0}
                    </span>{" "}
                    Duplicate
                    {!primaryBookmarkId ||
                    !selectedBookmarkIds ||
                    selectedBookmarkIds.filter(
                      (id) => String(id) !== String(primaryBookmarkId),
                    ).length === 1
                      ? ""
                      : "s"}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DuplicatesView;
