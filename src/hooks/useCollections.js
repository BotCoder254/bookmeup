import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils';
import toast from 'react-hot-toast';

// Collections hooks
export const useCollections = () => {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => apiClient.getCollections(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.createCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Collection created successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create collection');
    },
  });
};

export const useUpdateCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.updateCollection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Collection updated successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update collection');
    },
  });
};

export const useDeleteCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.deleteCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Collection deleted successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete collection');
    },
  });
};

export const useReorderCollections = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.reorderCollections,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Collections reordered successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reorder collections');
    },
  });
};

export const useSetCollectionCoverImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, coverImageUrl }) => apiClient.setCollectionCoverImage(id, coverImageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success('Cover image updated successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update cover image');
    },
  });
};