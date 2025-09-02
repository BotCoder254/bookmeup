import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, parseSearchQuery, buildSearchQuery, getFilterChips } from '../utils';
import toast from 'react-hot-toast';

// Search query keys
export const searchKeys = {
  all: ['search'],
  search: (query, filters) => [...searchKeys.all, 'search', { query, filters }],
  suggestions: (query) => [...searchKeys.all, 'suggestions', query],
  syntax: () => [...searchKeys.all, 'syntax'],
};

// Saved views query keys
export const savedViewKeys = {
  all: ['savedViews'],
  lists: () => [...savedViewKeys.all, 'list'],
  detail: (id) => [...savedViewKeys.all, 'detail', id],
};

// Search hooks
export const useAdvancedSearch = (query, options = {}) => {
  const { fuzzy = false, duplicates = false, enabled = true } = options;
  
  return useQuery({
    queryKey: searchKeys.search(query, { fuzzy, duplicates }),
    queryFn: () => apiClient.searchBookmarks({ 
      q: query, 
      fuzzy: fuzzy.toString(),
      duplicates: duplicates.toString() 
    }),
    enabled: enabled && !!query,
    staleTime: 5 * 60 * 1000, // 5 minutes
    keepPreviousData: true,
  });
};

export const useSearchSuggestions = (query, enabled = true) => {
  return useQuery({
    queryKey: searchKeys.suggestions(query),
    queryFn: () => apiClient.getSearchSuggestions(query),
    enabled: enabled && !!query && query.length > 2,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Saved Views hooks
export const useSavedViews = () => {
  return useQuery({
    queryKey: savedViewKeys.lists(),
    queryFn: () => apiClient.getSavedViews(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateSavedView = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.createSavedView,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.lists() });
      toast.success('Smart view saved successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save view');
    },
  });
};

export const useUpdateSavedView = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.updateSavedView(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: savedViewKeys.detail(variables.id) });
      toast.success('Smart view updated successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update view');
    },
  });
};

export const useDeleteSavedView = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.deleteSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.lists() });
      toast.success('Smart view deleted successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete view');
    },
  });
};

export const useUseSavedView = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.useSavedView,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: savedViewKeys.detail(id) });
    },
    onError: (error) => {
      console.error('Failed to update view usage:', error);
    },
  });
};

export const useReorderSavedViews = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.reorderSavedViews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.lists() });
      toast.success('Views reordered successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reorder views');
    },
  });
};

// Custom hook for managing search state
export const useSearchState = (initialQuery = '') => {
  const [searchQuery, setSearchQuery] = React.useState(initialQuery);
  const [filters, setFilters] = React.useState({});
  const [activeFilters, setActiveFilters] = React.useState([]);
  
  const updateFilter = (key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (value === null || value === undefined || value === '') {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }
      return newFilters;
    });
  };
  
  const removeFilter = (key, value = null) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (Array.isArray(newFilters[key]) && value !== null) {
        newFilters[key] = newFilters[key].filter(v => v !== value);
        if (newFilters[key].length === 0) {
          delete newFilters[key];
        }
      } else {
        delete newFilters[key];
      }
      return newFilters;
    });
  };
  
  const clearAllFilters = () => {
    setFilters({});
    setSearchQuery('');
  };
  
  const applyFiltersFromQuery = (query) => {
    const { filters: parsedFilters, textQuery } = parseSearchQuery(query);
    setFilters(parsedFilters);
    setSearchQuery(textQuery);
  };
  
  const getFullQuery = () => {
    return buildSearchQuery(filters, searchQuery);
  };
  
  React.useEffect(() => {
    const chips = getFilterChips(filters);
    setActiveFilters(chips);
  }, [filters]);
  
  return {
    searchQuery,
    setSearchQuery,
    filters,
    activeFilters,
    updateFilter,
    removeFilter,
    clearAllFilters,
    applyFiltersFromQuery,
    getFullQuery,
  };
};