import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiBookmark,
  FiStar,
  FiArchive,
  FiTag,
  FiFolder,
  FiPlus,
  FiSearch,
  FiSettings,
  FiMenu,
  FiX,
  FiCopy,
} from "react-icons/fi";
import { useTags, useCollections } from "../../hooks";
import TagManager from "../tags/TagManager";
import CollectionManager from "../collections/CollectionManager";

const Sidebar = ({ isCollapsed, onToggle, activeView, onViewChange }) => {
  const [showTagForm, setShowTagForm] = useState(false);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const {
    data: tagsData = [],
    isLoading: tagsLoading,
    error: tagsError,
  } = useTags();
  const {
    data: collectionsData = [],
    isLoading: collectionsLoading,
    error: collectionsError,
  } = useCollections();

  // Ensure tags and collections are properly processed as arrays
  const tags = Array.isArray(tagsData) ? tagsData : [];
  const collections = Array.isArray(collectionsData) ? collectionsData : [];

  // Debug logging to check what's coming from the API
  console.log("Tags in sidebar:", tags);
  console.log("Collections in sidebar:", collections);

  const mainNavItems = [
    { id: "all", label: "All Bookmarks", icon: FiBookmark, path: "/dashboard" },
    { id: "favorites", label: "Favorites", icon: FiStar, path: "/favorites" },
    { id: "archived", label: "Archived", icon: FiArchive, path: "/archived" },
    {
      id: "duplicates",
      label: "Duplicates",
      icon: FiCopy,
      path: "/duplicates",
    },
  ];

  const handleTagSelect = (tag) => {
    console.log("Tag selected:", tag);
    // Update selected tags
    const newSelectedTags = selectedTags.includes(tag.id)
      ? selectedTags.filter((id) => id !== tag.id)
      : [...selectedTags, tag.id];
    setSelectedTags(newSelectedTags);
    onViewChange("tag", tag.id);
  };

  const handleCollectionSelect = (collection) => {
    console.log("Collection selected:", collection);
    setSelectedCollection(collection);
    onViewChange("collection", collection.id);
  };

  return (
    <motion.div
      className={`${
        isCollapsed ? "w-16" : "w-64"
      } bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300`}
      initial={false}
      animate={{ width: isCollapsed ? 64 : 256 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center space-x-2"
              >
                <FiBookmark className="w-8 h-8 text-primary-600" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  BookmarkVault
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <FiMenu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <FiX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* Main Navigation */}
        <nav className="space-y-1 px-3">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive
                    ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="ml-3 font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {/* Collections */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 px-3"
            >
              <CollectionManager
                isCollapsed={isCollapsed}
                onCollectionSelect={handleCollectionSelect}
                selectedCollection={selectedCollection}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tags */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 px-3"
            >
              <TagManager
                isCollapsed={isCollapsed}
                onTagSelect={handleTagSelect}
                selectedTags={selectedTags}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <button className="w-full flex items-center px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <FiSettings className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="ml-3 font-medium"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
