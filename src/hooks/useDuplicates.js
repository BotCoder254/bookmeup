import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../utils";

export const useDuplicates = () => {
  return useQuery({
    queryKey: ["duplicates"],
    queryFn: () => apiClient.getBookmarkDuplicates(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    select: (data) => data.data,
  });
};

export const useMergeBookmarks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ primaryId, duplicateIds }) =>
      apiClient.mergeBookmarks(primaryId, duplicateIds),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["savedViews"] });
    },
  });
};

export const useDuplicateBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookmarkId) => apiClient.duplicateBookmark(bookmarkId),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["savedViews"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
};

export const useDuplicatesView = () => {
  return useQuery({
    queryKey: ["duplicatesView"],
    queryFn: () => apiClient.getDuplicatesView(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    select: (data) => data.data,
  });
};
