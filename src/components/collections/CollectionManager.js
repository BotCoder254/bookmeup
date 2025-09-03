import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiFolder,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiMenu,
  FiChevronUp,
  FiChevronDown,
  FiX,
  FiCheck,
  FiImage,
} from "react-icons/fi";
import {
  useCollections,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useReorderCollections,
  useSetCollectionCoverImage,
} from "../../hooks";
import toast from "react-hot-toast";

const CollectionManager = ({
  isCollapsed,
  onCollectionSelect,
  selectedCollection,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [draggedCollection, setDraggedCollection] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const { data: collectionsData = [], isLoading, error } = useCollections();

  // Ensure collections is always an array
  const collections = Array.isArray(collectionsData) ? collectionsData : [];

  // Debug logging
  console.log("Collections in CollectionManager:", collections);
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();
  const reorderCollections = useReorderCollections();
  const setCoverImage = useSetCollectionCoverImage();

  // Use our processed collections array
  const safeCollections = collections;

  const [newCollection, setNewCollection] = useState({
    name: "",
    description: "",
    is_public: false,
  });

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollection.name.trim()) return;

    try {
      console.log("Creating collection:", newCollection);
      await createCollection.mutateAsync({
        ...newCollection,
        order: safeCollections.length, // Add to end
      });
      setNewCollection({ name: "", description: "", is_public: false });
      setShowForm(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleUpdateCollection = async (collectionId, updates) => {
    try {
      console.log("Updating collection:", collectionId, "with data:", updates);
      await updateCollection.mutateAsync({ id: collectionId, ...updates });
      setEditingCollection(null);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this collection? Bookmarks will not be deleted.",
      )
    ) {
      try {
        await deleteCollection.mutateAsync(collectionId);
      } catch (error) {
        // Error handled by hook
      }
    }
  };

  const handleReorder = async (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const reorderedCollections = [...safeCollections];
    const [movedCollection] = reorderedCollections.splice(fromIndex, 1);
    reorderedCollections.splice(toIndex, 0, movedCollection);

    // Update order values
    const collectionOrders = reorderedCollections.map((collection, index) => ({
      id: collection.id,
      order: index,
    }));

    try {
      await reorderCollections.mutateAsync(collectionOrders);
    } catch (error) {
      // Error handled by hook
    }
  };

  const moveCollection = (collectionId, direction) => {
    const currentIndex = safeCollections.findIndex(
      (collection) => collection.id === collectionId,
    );
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < safeCollections.length) {
      handleReorder(currentIndex, newIndex);
    }
  };

  const handleSetCoverImage = async (collectionId, imageUrl) => {
    try {
      await setCoverImage.mutateAsync({
        id: collectionId,
        coverImageUrl: imageUrl,
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDragStart = (e, collection) => {
    setDraggedCollection(collection);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetCollection) => {
    e.preventDefault();
    if (!draggedCollection || draggedCollection.id === targetCollection.id)
      return;

    const fromIndex = safeCollections.findIndex(
      (collection) => collection.id === draggedCollection.id,
    );
    const toIndex = safeCollections.findIndex(
      (collection) => collection.id === targetCollection.id,
    );

    handleReorder(fromIndex, toIndex);
    setDraggedCollection(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-500 dark:text-red-400 text-sm">
        Failed to load collections
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Collections
        </h3>
        {!isCollapsed && (
          <button
            onClick={() => setShowForm(true)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Add Collection"
          >
            <FiPlus className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Create Collection Form */}
      <AnimatePresence>
        {showForm && !isCollapsed && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleCreateCollection}
            className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <input
              type="text"
              placeholder="Collection name"
              value={newCollection.name}
              onChange={(e) =>
                setNewCollection({ ...newCollection, name: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />

            <textarea
              placeholder="Description (optional)"
              value={newCollection.description}
              onChange={(e) =>
                setNewCollection({
                  ...newCollection,
                  description: e.target.value,
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              rows={2}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={newCollection.is_public}
                  onChange={(e) =>
                    setNewCollection({
                      ...newCollection,
                      is_public: e.target.checked,
                    })
                  }
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <span>Public</span>
              </label>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setNewCollection({
                      name: "",
                      description: "",
                      is_public: false,
                    });
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FiX className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={
                    !newCollection.name.trim() || createCollection.isLoading
                  }
                  className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  <FiCheck className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Collections List */}
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {safeCollections.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            No collections yet. Create your first collection!
          </div>
        ) : (
          <AnimatePresence>
            {safeCollections.map((collection, index) => (
              <motion.div
                key={collection.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="group"
              >
                {editingCollection?.id === collection.id ? (
                  <EditCollectionForm
                    collection={collection}
                    onSave={(updates) =>
                      handleUpdateCollection(collection.id, updates)
                    }
                    onCancel={() => setEditingCollection(null)}
                    isLoading={updateCollection.isLoading}
                  />
                ) : (
                  <CollectionItem
                    collection={collection}
                    index={index}
                    isSelected={selectedCollection?.id === collection.id}
                    isCollapsed={isCollapsed}
                    isMobile={isMobile}
                    onSelect={() => onCollectionSelect?.(collection)}
                    onEdit={() => setEditingCollection(collection)}
                    onDelete={() => handleDeleteCollection(collection.id)}
                    onSetCoverImage={(imageUrl) =>
                      handleSetCoverImage(collection.id, imageUrl)
                    }
                    onMove={(direction) =>
                      moveCollection(collection.id, direction)
                    }
                    onDragStart={(e) => handleDragStart(e, collection)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, collection)}
                    canMoveUp={index > 0}
                    canMoveDown={index < safeCollections.length - 1}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

// Individual collection item component
const CollectionItem = ({
  collection,
  index,
  isSelected,
  isCollapsed,
  isMobile,
  onSelect,
  onEdit,
  onDelete,
  onMove,
  onSetCoverImage,
  onDragStart,
  onDragOver,
  onDrop,
  canMoveUp,
  canMoveDown,
}) => {
  console.log("Rendering collection item:", collection);
  const [showCoverImageInput, setShowCoverImageInput] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState("");

  const handleSetCoverImage = (e) => {
    e.preventDefault();
    if (coverImageUrl.trim()) {
      onSetCoverImage(coverImageUrl.trim());
      setCoverImageUrl("");
      setShowCoverImageInput(false);
    }
  };

  return (
    <div
      className={`flex items-center px-2 py-2 rounded-lg text-left transition-colors cursor-pointer ${
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
      onClick={() => onSelect && onSelect(collection)}
      draggable={!isMobile}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drag Handle / Mobile Controls */}
      <div className="flex items-center mr-2">
        {isMobile ? (
          <div className="flex flex-col">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove("up");
              }}
              disabled={!canMoveUp}
              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <FiChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove("down");
              }}
              disabled={!canMoveDown}
              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <FiChevronDown className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <FiMenu className="w-4 h-4 text-gray-400 group-hover:text-gray-600 cursor-grab" />
        )}
      </div>

      {/* Collection Cover/Icon */}
      <div className="flex-shrink-0 mr-3">
        {collection.cover_image_url ? (
          <img
            src={collection.cover_image_url}
            alt={collection.name}
            className="w-8 h-8 rounded object-cover"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className={`w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center ${
            collection.cover_image_url ? "hidden" : "flex"
          }`}
        >
          <FiFolder className="w-4 h-4 text-gray-500" />
        </div>
      </div>

      {/* Collection Name and Count */}
      <div className="flex-1 min-w-0">
        {!isCollapsed && (
          <>
            <span className="text-sm font-medium truncate block">
              {collection.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {collection.bookmark_count} bookmark
              {collection.bookmark_count !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>

      {/* Actions */}
      {!isCollapsed && (
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCoverImageInput(!showCoverImageInput);
            }}
            className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
            title="Set Cover Image"
          >
            <FiImage className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit Collection"
          >
            <FiEdit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete Collection"
          >
            <FiTrash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Cover Image Input */}
      {showCoverImageInput && (
        <div className="absolute z-10 mt-12 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
          <form onSubmit={handleSetCoverImage} className="flex space-x-2">
            <input
              type="url"
              placeholder="Image URL"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
            <button
              type="submit"
              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Set
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

// Edit collection form component
const EditCollectionForm = ({ collection, onSave, onCancel, isLoading }) => {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [isPublic, setIsPublic] = useState(collection.is_public);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      is_public: isPublic,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        autoFocus
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        rows={2}
      />

      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded text-primary-600 focus:ring-primary-500"
          />
          <span>Public</span>
        </label>

        <div className="flex space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <FiX className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
          >
            <FiCheck className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  );
};

export default CollectionManager;
