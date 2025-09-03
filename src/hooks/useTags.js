import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../utils";
import toast from "react-hot-toast";

// Tags hooks
export const useTags = () => {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const data = await apiClient.getTags();
      console.log("Tags API response:", data);
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagData) => {
      console.log("Creating tag with data:", tagData);
      const response = await apiClient.createTag(tagData);
      console.log("Create tag response:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("Tag created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tag created successfully!");
    },
    onError: (error) => {
      console.error("Create tag error:", error);
      toast.error(error.message || "Failed to create tag");
    },
  });
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tag updated successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update tag");
    },
  });
};

export const useDeleteTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tag deleted successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete tag");
    },
  });
};

export const useReorderTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.reorderTags,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tags reordered successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reorder tags");
    },
  });
};

export const useRecentTagSuggestions = () => {
  return useQuery({
    queryKey: ["tags", "recent"],
    queryFn: () => apiClient.getRecentTagSuggestions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
