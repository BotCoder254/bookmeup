import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../utils";
import toast from "react-hot-toast";

// Query keys
export const historyKeys = {
  all: ["history"],
  lists: () => [...historyKeys.all, "list"],
  list: (filters) => [...historyKeys.lists(), filters],
  byBookmark: (bookmarkId) => [...historyKeys.all, "bookmark", bookmarkId],
};

// Get browsing history
export const useBookmarkHistory = (filters = {}) => {
  return useQuery({
    queryKey: historyKeys.list(filters),
    queryFn: () => apiClient.getBookmarkHistory(),
    staleTime: 60 * 1000, // 1 minute
  });
};

// Add to browsing history
export const useAddToHistory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookmarkId, referrer = null }) => {
      // Get page referrer info
      const historyData = {
        referrer: referrer || document.referrer || null,
      };
      return apiClient.addToHistory(bookmarkId, historyData);
    },
    onSuccess: () => {
      // Invalidate the history list
      queryClient.invalidateQueries({ queryKey: historyKeys.lists() });

      // Don't show a success toast for history entries
      // It would be too intrusive for a background operation
    },
    onError: (error) => {
      console.error("Add to history error:", error);
      // Don't show error toasts for history - just log to console
      // This is a background operation and shouldn't interrupt user
    },
  });
};

// Custom hook to record a visit when component mounts
export const useRecordVisit = (bookmarkId) => {
  const addToHistory = useAddToHistory();

  React.useEffect(() => {
    if (bookmarkId) {
      addToHistory.mutate({ bookmarkId });
    }
  }, [bookmarkId]); // Only run when bookmarkId changes

  return { isRecording: addToHistory.isLoading };
};
