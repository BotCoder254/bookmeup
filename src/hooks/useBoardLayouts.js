import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../utils";
import toast from "react-hot-toast";

// Query keys
export const boardLayoutKeys = {
  all: ["boardLayouts"],
  lists: () => [...boardLayoutKeys.all, "list"],
  list: (filters) => [...boardLayoutKeys.lists(), filters],
  details: () => [...boardLayoutKeys.all, "detail"],
  detail: (id) => [...boardLayoutKeys.details(), id],
  collection: (collectionId) => [...boardLayoutKeys.all, "collection", collectionId],
};

// Get all board layouts
export const useBoardLayouts = (filters = {}) => {
  return useQuery({
    queryKey: boardLayoutKeys.list(filters),
    queryFn: () => apiClient.getBoardLayouts(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get layout for a specific collection
export const useCollectionLayout = (collectionId) => {
  return useQuery({
    queryKey: boardLayoutKeys.collection(collectionId),
    queryFn: () => apiClient.getCollectionLayout(collectionId),
    enabled: !!collectionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Create a new board layout
export const useCreateBoardLayout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layoutData) => apiClient.createBoardLayout(layoutData),
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: boardLayoutKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: boardLayoutKeys.collection(variables.collection),
      });
      toast.success("Board layout created successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create board layout");
    },
  });
};

// Update a board layout
export const useUpdateBoardLayout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.updateBoardLayout(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: boardLayoutKeys.detail(variables.id) });
      queryClient.invalidateQueries({
        queryKey: boardLayoutKeys.collection(variables.collection),
      });
      // Don't show toast for every position update
      if (!variables.silent) {
        toast.success("Board layout updated!");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update board layout");
    },
  });
};

// Create a new layout version
export const useCreateNewLayoutVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layoutId) => apiClient.createNewLayoutVersion(layoutId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: boardLayoutKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: boardLayoutKeys.collection(data.collection),
      });
      toast.success("New layout version created!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create new layout version");
    },
  });
};
