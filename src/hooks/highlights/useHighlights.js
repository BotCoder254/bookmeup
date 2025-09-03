import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "../../utils";
import toast from "react-hot-toast";

// Query keys
export const highlightKeys = {
  all: ["highlights"],
  lists: () => [...highlightKeys.all, "list"],
  list: (filters) => [...highlightKeys.lists(), filters],
  byBookmark: (bookmarkId) => [...highlightKeys.all, "bookmark", bookmarkId],
  details: () => [...highlightKeys.all, "detail"],
  detail: (id) => [...highlightKeys.details(), id],
};

// Get all highlights for a bookmark
export const useBookmarkHighlights = (bookmarkId) => {
  return useQuery({
    queryKey: highlightKeys.byBookmark(bookmarkId),
    queryFn: () => apiClient.getBookmarkHighlights(bookmarkId),
    enabled: !!bookmarkId,
  });
};

// Create a new highlight
export const useCreateHighlight = (bookmarkId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (highlightData) =>
      apiClient.createHighlight(bookmarkId, highlightData),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: highlightKeys.byBookmark(bookmarkId) });
      toast.success("Highlight created successfully!");
    },
    onError: (error) => {
      console.error("Create highlight error:", error);
      toast.error(error.message || "Failed to create highlight");
    },
  });
};

// Update an existing highlight
export const useUpdateHighlight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, bookmarkId, ...data }) =>
      apiClient.updateHighlight(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: highlightKeys.byBookmark(variables.bookmarkId),
      });
      toast.success("Highlight updated successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update highlight");
    },
  });
};

// Delete a highlight
export const useDeleteHighlight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, bookmarkId }) => apiClient.deleteHighlight(id),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: highlightKeys.byBookmark(variables.bookmarkId),
      });
      toast.success("Highlight removed successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete highlight");
    },
  });
};
