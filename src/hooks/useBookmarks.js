import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../utils';
import toast from 'react-hot-toast';

// Query keys
export const bookmarkKeys = {
  all: ['bookmarks'],
  lists: () => [...bookmarkKeys.all, 'list'],
  list: (filters) => [...bookmarkKeys.lists(), filters],
  library: (filters) => [...bookmarkKeys.all, 'library', filters],
  details: () => [...bookmarkKeys.all, 'detail'],
  detail: (id) => [...bookmarkKeys.details(), id],
  stats: () => [...bookmarkKeys.all, 'stats'],
};

// Bookmarks hooks
export const useBookmarks = (filters = {}) => {
  return useQuery({
    queryKey: bookmarkKeys.list(filters),
    queryFn: () => apiClient.getBookmarks(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useInfiniteBookmarks = (filters = {}) => {
  return useInfiniteQuery({
    queryKey: bookmarkKeys.library(filters),
    queryFn: ({ pageParam = 1 }) => {
      return apiClient.getBookmarksLibrary({ ...filters, page: pageParam });
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.next) {
        const url = new URL(lastPage.next);
        return url.searchParams.get('page');
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useBookmark = (id) => {
  return useQuery({
    queryKey: bookmarkKeys.detail(id),
    queryFn: () => apiClient.getBookmark(id),
    enabled: !!id,
  });
};

export const useBookmarkStats = () => {
  return useQuery({
    queryKey: bookmarkKeys.stats(),
    queryFn: () => apiClient.getStats(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.createBookmark,
    onSuccess: (data) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Bookmark created successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create bookmark');
    },
  });
};

export const useQuickAddBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.quickAddBookmark,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.stats() });
      toast.success('Bookmark added successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add bookmark');
    },
  });
};

export const useUpdateBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.updateBookmark(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.stats() });
      toast.success('Bookmark updated successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update bookmark');
    },
  });
};

export const useDeleteBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.deleteBookmark,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.stats() });
      toast.success('Bookmark deleted successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete bookmark');
    },
  });
};

export const useToggleFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.toggleFavorite,
    onSuccess: (data, id) => {
      // Invalidate all bookmark-related queries
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      
      // Show appropriate toast message
      if (data.is_favorite) {
        toast.success('Added to favorites!');
      } else {
        toast.success('Removed from favorites!');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update favorite status');
    },
  });
};

export const useToggleArchive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.toggleArchive,
    onSuccess: (data, id) => {
      // Invalidate all bookmark-related queries
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      
      // Show appropriate toast message
      if (data.is_archived) {
        toast.success('Moved to archive!');
      } else {
        toast.success('Restored from archive!');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update archive status');
    },
  });
};

export const useVisitBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.visitBookmark,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.detail(id) });
    },
    onError: (error) => {
      console.error('Failed to log visit:', error);
    },
  });
};