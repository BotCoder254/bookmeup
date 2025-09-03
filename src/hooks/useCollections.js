import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../utils";
import toast from "react-hot-toast";

// Collections hooks
export const useCollections = () => {
  return useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const data = await apiClient.getCollections();
      console.log("Collections API response:", data);
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (collectionData) => {
      console.log("Creating collection with data:", collectionData);
      const response = await apiClient.createCollection(collectionData);
      console.log("Create collection response:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("Collection created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection created successfully!");
    },
    onError: (error) => {
      console.error("Create collection error:", error);
      toast.error(error.message || "Failed to create collection");
    },
  });
};

export const useUpdateCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      console.log("Updating collection:", id, "with data:", data);
      const response = await apiClient.updateCollection(id, data);
      console.log("Update collection response:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("Collection updated successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection updated successfully!");
    },
    onError: (error) => {
      console.error("Update collection error:", error);
      toast.error(error.message || "Failed to update collection");
    },
  });
};

export const useDeleteCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.deleteCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection deleted successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete collection");
    },
  });
};

export const useReorderCollections = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.reorderCollections,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collections reordered successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reorder collections");
    },
  });
};

export const useSetCollectionCoverImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, coverImageUrl }) => {
      console.log(
        "Setting collection cover image:",
        id,
        "with URL:",
        coverImageUrl,
      );
      const response = await apiClient.setCollectionCoverImage(
        id,
        coverImageUrl,
      );
      console.log("Set collection cover image response:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("Cover image updated successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Cover image updated successfully!");
    },
    onError: (error) => {
      console.error("Set collection cover image error:", error);
      toast.error(error.message || "Failed to update cover image");
    },
  });
};
