import React, { useState, useEffect, useCallback } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "react-responsive";
import {
  FiRefreshCw,
  FiSave,
  FiGrid,
  FiList,
  FiGitBranch,
  FiAlertCircle,
  FiInfo,
} from "react-icons/fi";
import { useBookmarks, useCollectionLayout, useCreateBoardLayout, useUpdateBoardLayout } from "../../../hooks";
import GridBoard from "./GridBoard";
import BoardCard from "./BoardCard";
import LoadingSpinner from "../../LoadingSpinner";
import { debounce } from "../../../utils";

const BoardView = ({ collection, activeView }) => {
  const [viewMode, setViewMode] = useState("grid");
  const [isDragging, setIsDragging] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [layout, setLayout] = useState({});
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Filters for getting bookmarks for this collection
  const filters = {
    collection: collection?.id,
  };

  const { data, isLoading, isError, error } = useBookmarks(filters);
  const bookmarks = data?.results || [];

  // Get saved layout from the server
  const {
    data: layoutData,
    isLoading: isLayoutLoading,
    isError: isLayoutError
  } = useCollectionLayout(collection?.id);

  const createLayout = useCreateBoardLayout();
  const updateLayout = useUpdateBoardLayout();

  const isMobile = useMediaQuery({ maxWidth: 768 });
  const backend = isMobile ? TouchBackend : HTML5Backend;

  // Initialize grid layout from saved layout or create a default one
  useEffect(() => {
    if (layoutData && layoutData.id && layoutData.layout_data) {
      setLayout({
        id: layoutData.id,
        collection: collection?.id,
        layout_data: layoutData.layout_data
      });
    } else if (bookmarks.length > 0 && collection) {
      // Create default layout (all cards in a grid)
      const defaultLayout = {
        collection: collection.id,
        layout_data: {
          items: bookmarks.map((bookmark, index) => ({
            id: bookmark.id,
            x: (index % 3) * 1,  // Simple grid layout
            y: Math.floor(index / 3) * 1,
            w: 1,
            h: 1,
          })),
          version: 1,
          settings: {
            gridSize: 20,
            columns: 3,
          }
        }
      };
      setLayout(defaultLayout);
    }
  }, [layoutData, bookmarks, collection]);

  // Handle layout updates
  const handleLayoutChange = useCallback((newLayout) => {
    setLayout(prev => ({
      ...prev,
      layout_data: {
        ...prev.layout_data,
        items: newLayout
      }
    }));
    setUnsavedChanges(true);
  }, []);

  // Debounce saving layout changes
  const debouncedSaveLayout = useCallback(
    debounce(() => {
      if (unsavedChanges) {
        if (layout.id) {
          updateLayout.mutate({
            id: layout.id,
            collection: layout.collection,
            layout_data: layout.layout_data,
            silent: true  // Don't show toast for auto-saves
          }, {
            onSuccess: () => {
              setUnsavedChanges(false);
            }
          });
        } else {
          createLayout.mutate({
            collection: layout.collection,
            layout_data: layout.layout_data,
          }, {
            onSuccess: (data) => {
              setLayout(prev => ({ ...prev, id: data.id }));
              setUnsavedChanges(false);
            }
          });
        }
      }
    }, 2000),
    [layout, unsavedChanges, updateLayout, createLayout]
  );

  // Auto-save layout changes
  useEffect(() => {
    if (unsavedChanges && layout.collection) {
      debouncedSaveLayout();
    }
  }, [layout, unsavedChanges, debouncedSaveLayout]);

  // Manual save function
  const handleSaveLayout = () => {
    if (layout.id) {
      updateLayout.mutate({
        id: layout.id,
        collection: layout.collection,
        layout_data: layout.layout_data,
      }, {
        onSuccess: () => {
          setUnsavedChanges(false);
        }
      });
    } else {
      createLayout.mutate({
        collection: layout.collection,
        layout_data: layout.layout_data,
      }, {
        onSuccess: (data) => {
          setLayout(prev => ({ ...prev, id: data.id }));
          setUnsavedChanges(false);
        }
      });
    }
  };

  // Reset layout to server version
  const handleResetLayout = () => {
    if (layoutData && layoutData.id && layoutData.layout_data) {
      setLayout({
        id: layoutData.id,
        collection: collection?.id,
        layout_data: layoutData.layout_data
      });
      setUnsavedChanges(false);
    }
  };

  if (isLoading || isLayoutLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">
          Error loading bookmarks: {error.message}
        </p>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12"
      >
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No bookmarks in this collection. Add bookmarks to create a visual board.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-2 mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-md ${
              viewMode === "grid"
                ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title="Grid view"
          >
            <FiGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-md ${
              viewMode === "list"
                ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title="List view"
          >
            <FiList className="w-5 h-5" />
          </button>
          <div className="border-r border-gray-200 dark:border-gray-700 h-6 mx-2" />
          <button
            onClick={handleResetLayout}
            disabled={!unsavedChanges}
            className={`p-2 rounded-md ${
              unsavedChanges
                ? "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
            }`}
            title="Reset changes"
          >
            <FiRefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleSaveLayout}
            disabled={!unsavedChanges}
            className={`p-2 rounded-md ${
              unsavedChanges
                ? "text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
                : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
            }`}
            title="Save layout"
          >
            <FiSave className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {unsavedChanges && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center">
              <FiAlertCircle className="w-3 h-3 mr-1" />
              Unsaved changes
            </span>
          )}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Help"
          >
            <FiInfo className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Help tooltip */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-2 top-14 w-64 p-3 bg-white dark:bg-gray-800 shadow-lg rounded-md z-20 text-sm border border-gray-200 dark:border-gray-700"
          >
            <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Visual Board Help</h4>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Drag cards to arrange them</li>
              <li>• Changes auto-save after 2 seconds</li>
              <li>• Click Save to manually save</li>
              <li>• Click Reset to discard changes</li>
              {isMobile && <li>• Long-press to drag on mobile</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board content */}
      <DndProvider backend={backend}>
        <div
          className={`${isDragging ? 'cursor-grabbing' : ''}`}
          style={{
            minHeight: viewMode === 'grid' ? '600px' : 'auto',
            transition: 'all 0.3s ease'
          }}
        >
          {viewMode === "grid" ? (
            <GridBoard
              bookmarks={bookmarks}
              layout={layout.layout_data?.items || []}
              onLayoutChange={handleLayoutChange}
              setIsDragging={setIsDragging}
              isMobile={isMobile}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {bookmarks.map((bookmark) => (
                <BoardCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  draggable={false}
                />
              ))}
            </div>
          )}
        </div>
      </DndProvider>
    </div>
  );
};

export default BoardView;
