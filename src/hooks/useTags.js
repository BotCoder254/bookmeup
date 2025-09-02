import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils';
import toast from 'react-hot-toast';

// Tags hooks
export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => apiClient.getTags(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag created successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create tag');
    },
  });
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag updated successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update tag');
    },
  });
};

export const useDeleteTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag deleted successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete tag');
    },
  });
};

export const useReorderTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.reorderTags,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tags reordered successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reorder tags');
    },
  });
};

export const useRecentTagSuggestions = () => {
  return useQuery({
    queryKey: ['tags', 'recent'],
    queryFn: () => apiClient.getRecentTagSuggestions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};