import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiTag,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiMenu,
  FiChevronUp,
  FiChevronDown,
  FiX,
  FiCheck,
} from "react-icons/fi";
import {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useReorderTags,
} from "../../hooks";
import toast from "react-hot-toast";

const TagManager = ({ isCollapsed, onTagSelect, selectedTags = [] }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [draggedTag, setDraggedTag] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const { data: tagsData = [], isLoading, error } = useTags();

  // Ensure tags is always an array
  const tags = Array.isArray(tagsData) ? tagsData : [];

  // Debug logging
  console.log("Tags in TagManager:", tags);
  console.log("Selected tags in TagManager:", selectedTags);
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const reorderTags = useReorderTags();

  // Use our processed tags array
  const safeTags = tags;

  const [newTag, setNewTag] = useState({ name: "", color: "#6366f1" });

  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#10b981",
    "#06b6d4",
    "#3b82f6",
  ];

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTag.name.trim()) return;

    try {
      await createTag.mutateAsync({
        ...newTag,
        order: safeTags.length, // Add to end
      });
      setNewTag({ name: "", color: "#6366f1" });
      setShowForm(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleUpdateTag = async (tagId, updates) => {
    try {
      await updateTag.mutateAsync({ id: tagId, ...updates });
      setEditingTag(null);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (window.confirm("Are you sure you want to delete this tag?")) {
      try {
        await deleteTag.mutateAsync(tagId);
      } catch (error) {
        // Error handled by hook
      }
    }
  };

  const handleReorder = async (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const reorderedTags = [...safeTags];
    const [movedTag] = reorderedTags.splice(fromIndex, 1);
    reorderedTags.splice(toIndex, 0, movedTag);

    // Update order values
    const tagOrders = reorderedTags.map((tag, index) => ({
      id: tag.id,
      order: index,
    }));

    try {
      await reorderTags.mutateAsync(tagOrders);
    } catch (error) {
      // Error handled by hook
    }
  };

  const moveTag = (tagId, direction) => {
    const currentIndex = safeTags.findIndex((tag) => tag.id === tagId);
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < safeTags.length) {
      handleReorder(currentIndex, newIndex);
    }
  };

  const handleDragStart = (e, tag) => {
    setDraggedTag(tag);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetTag) => {
    e.preventDefault();
    if (!draggedTag || draggedTag.id === targetTag.id) return;

    const fromIndex = safeTags.findIndex((tag) => tag.id === draggedTag.id);
    const toIndex = safeTags.findIndex((tag) => tag.id === targetTag.id);

    handleReorder(fromIndex, toIndex);
    setDraggedTag(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-500 dark:text-red-400 text-sm">
        Failed to load tags
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Tags
        </h3>
        {!isCollapsed && (
          <button
            onClick={() => setShowForm(true)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Add Tag"
          >
            <FiPlus className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Create Tag Form */}
      <AnimatePresence>
        {showForm && !isCollapsed && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleCreateTag}
            className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <input
              type="text"
              placeholder="Tag name"
              value={newTag.name}
              onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />

            <div className="flex items-center justify-between">
              <div className="flex flex-wrap space-x-1 overflow-x-auto max-w-[120px]">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTag({ ...newTag, color })}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                      newTag.color === color
                        ? "border-gray-400"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setNewTag({ name: "", color: "#6366f1" });
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FiX className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={!newTag.name.trim() || createTag.isLoading}
                  className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  <FiCheck className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Tags List */}
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {safeTags.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            No tags yet. Create your first tag!
          </div>
        ) : (
          <AnimatePresence>
            {safeTags.map((tag, index) => (
              <motion.div
                key={tag.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="group"
              >
                {editingTag?.id === tag.id ? (
                  <EditTagForm
                    tag={tag}
                    colors={colors}
                    onSave={(updates) => handleUpdateTag(tag.id, updates)}
                    onCancel={() => setEditingTag(null)}
                    isLoading={updateTag.isLoading}
                  />
                ) : (
                  <TagItem
                    tag={tag}
                    index={index}
                    isSelected={
                      Array.isArray(selectedTags)
                        ? selectedTags.includes(tag.id)
                        : false
                    }
                    isCollapsed={isCollapsed}
                    isMobile={isMobile}
                    onSelect={() => onTagSelect?.(tag)}
                    onEdit={() => setEditingTag(tag)}
                    onDelete={() => handleDeleteTag(tag.id)}
                    onMove={(direction) => moveTag(tag.id, direction)}
                    onDragStart={(e) => handleDragStart(e, tag)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, tag)}
                    canMoveUp={index > 0}
                    canMoveDown={index < safeTags.length - 1}
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

// Individual tag item component
const TagItem = ({
  tag,
  index,
  isSelected,
  isCollapsed,
  isMobile,
  onSelect,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  canMoveUp,
  canMoveDown,
}) => {
  return (
    <div
      className={`flex items-center px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
      onClick={() => onSelect && onSelect(tag)}
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

      {/* Tag Color */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0 mr-2"
        style={{ backgroundColor: tag.color }}
      />

      {/* Tag Name and Count */}
      <div className="flex-1 min-w-0">
        {!isCollapsed && (
          <>
            <span className="text-sm font-medium truncate block">
              {tag.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tag.bookmark_count} bookmark{tag.bookmark_count !== 1 ? "s" : ""}
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
              onEdit();
            }}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit Tag"
          >
            <FiEdit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete Tag"
          >
            <FiTrash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

// Edit tag form component
const EditTagForm = ({ tag, colors, onSave, onCancel, isLoading }) => {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
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

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap space-x-1 overflow-x-auto max-w-[120px]">
          {colors.map((colorOption) => (
            <button
              key={colorOption}
              type="button"
              onClick={() => setColor(colorOption)}
              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                color === colorOption ? "border-gray-400" : "border-transparent"
              }`}
              style={{ backgroundColor: colorOption }}
            />
          ))}
        </div>

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

export default TagManager;
