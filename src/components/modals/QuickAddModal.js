import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  FiX, FiLink, FiStar, FiTag, FiFolder, FiPlus, FiCheck 
} from 'react-icons/fi';
import { useQuickAddBookmark, useTags, useCollections } from '../../hooks';
import { isValidUrl } from '../../utils';

const QuickAddModal = ({ isOpen, onClose }) => {
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);

  const quickAddBookmark = useQuickAddBookmark();
  const { data: tags = [], isLoading: tagsLoading, error: tagsError } = useTags();
  const { data: collections = [], isLoading: collectionsLoading, error: collectionsError } = useCollections();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  const url = watch('url');

  useEffect(() => {
    if (isOpen) {
      // Auto-focus URL field when modal opens
      setTimeout(() => {
        const urlInput = document.getElementById('quick-add-url');
        if (urlInput) urlInput.focus();
      }, 100);
    } else {
      // Reset form when modal closes
      reset();
      setSelectedTags([]);
      setNewTagName('');
      setShowNewTagInput(false);
    }
  }, [isOpen, reset]);

  const onSubmit = async (data) => {
    try {
      const bookmarkData = {
        url: data.url,
        title: data.title || '',
        description: data.description || '',
        is_favorite: data.is_favorite || false,
        collection_id: data.collection_id || null,
        tag_ids: selectedTags.map(tag => tag.id),
      };

      await quickAddBookmark.mutateAsync(bookmarkData);
      onClose();
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const handleTagToggle = (tag) => {
    setSelectedTags(prev => {
      const isSelected = prev.find(t => t.id === tag.id);
      if (isSelected) {
        return prev.filter(t => t.id !== tag.id);
      } else {
        return [...prev, tag];
      }
    });
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.95,
      y: 20,
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 25,
        stiffness: 500,
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95,
      y: 20,
      transition: {
        duration: 0.2,
      }
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Quick Add Bookmark
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {/* URL Field */}
              <div className="form-group">
                <label className="label" htmlFor="quick-add-url">
                  URL *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLink className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="quick-add-url"
                    type="url"
                    className={`input pl-10 ${errors.url ? 'input-error' : ''}`}
                    placeholder="https://example.com"
                    {...register('url', {
                      required: 'URL is required',
                      validate: (value) => isValidUrl(value) || 'Please enter a valid URL',
                    })}
                  />
                </div>
                {errors.url && (
                  <p className="error-message">{errors.url.message}</p>
                )}
              </div>

              {/* Title Field */}
              <div className="form-group">
                <label className="label" htmlFor="quick-add-title">
                  Title (optional)
                </label>
                <input
                  id="quick-add-title"
                  type="text"
                  className="input"
                  placeholder="Will be auto-fetched if left empty"
                  {...register('title')}
                />
              </div>

              {/* Description Field */}
              <div className="form-group">
                <label className="label" htmlFor="quick-add-description">
                  Description (optional)
                </label>
                <textarea
                  id="quick-add-description"
                  rows={2}
                  className="input resize-none"
                  placeholder="Will be auto-fetched if left empty"
                  {...register('description')}
                />
              </div>

              {/* Collection Selection */}
              <div className="form-group">
                <label className="label" htmlFor="quick-add-collection">
                  Collection (optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiFolder className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    id="quick-add-collection"
                    className="input pl-10"
                    {...register('collection_id')}
                  >
                    <option value="">Select a collection</option>
                    {Array.isArray(collections) && collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                    {collectionsLoading && (
                      <option disabled>Loading collections...</option>
                    )}
                    {collectionsError && (
                      <option disabled>Failed to load collections</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Tags Section */}
              <div className="form-group">
                <label className="label">Tags (optional)</label>
                
                {/* Selected Tags */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedTags.map((tag) => (
                      <motion.span
                        key={tag.id}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                      >
                        <div
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          className="ml-1 p-0.5 rounded-full hover:bg-primary-200 dark:hover:bg-primary-800"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </motion.span>
                    ))}
                  </div>
                )}

                {/* Available Tags */}
                <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(tags) && tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          selectedTags.find(t => t.id === tag.id)
                            ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                        {selectedTags.find(t => t.id === tag.id) && (
                          <FiCheck className="w-3 h-3 ml-1" />
                        )}
                      </button>
                    ))}
                    {tagsLoading && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 p-2">
                        Loading tags...
                      </div>
                    )}
                    {tagsError && (
                      <div className="text-sm text-red-500 dark:text-red-400 p-2">
                        Failed to load tags
                      </div>
                    )}
                    {!tagsLoading && !tagsError && (!tags || tags.length === 0) && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 p-2">
                        No tags available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Favorite Toggle */}
              <div className="flex items-center">
                <input
                  id="quick-add-favorite"
                  type="checkbox"
                  className="rounded text-primary-600 focus:ring-primary-500"
                  {...register('is_favorite')}
                />
                <label htmlFor="quick-add-favorite" className="ml-2 flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <FiStar className="w-4 h-4 mr-1" />
                  Add to favorites
                </label>
              </div>

              {/* Submit Button */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 btn btn-secondary"
                >
                  Cancel
                </button>
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn btn-primary flex items-center justify-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <FiPlus className="w-4 h-4" />
                      <span>Add Bookmark</span>
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuickAddModal;