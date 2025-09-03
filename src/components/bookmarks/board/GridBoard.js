import React, { useState, useEffect, useRef } from "react";
import { useDrop } from "react-dnd";
import { motion, AnimatePresence } from "framer-motion";
import { FiMove } from "react-icons/fi";
import BoardCard from "./BoardCard";

const GRID_SIZE = 20; // Size of grid cells in pixels
const COLUMNS = {
  xs: 1, // Mobile
  sm: 2, // Small tablets
  md: 3, // Large tablets
  lg: 4, // Desktop
  xl: 5, // Large desktop
};

const GridBoard = ({
  bookmarks,
  layout = [],
  onLayoutChange,
  setIsDragging,
  isMobile,
}) => {
  const [items, setItems] = useState([]);
  const gridRef = useRef(null);
  const [gridDimensions, setGridDimensions] = useState({ width: 0, height: 0 });
  const [columns, setColumns] = useState(3);
  const [showGrid, setShowGrid] = useState(false);

  // Calculate grid dimensions and number of columns based on screen size
  useEffect(() => {
    const updateGridDimensions = () => {
      if (gridRef.current) {
        const width = gridRef.current.offsetWidth;
        setGridDimensions({ width, height: 600 });

        // Determine number of columns based on width
        if (width < 640) setColumns(COLUMNS.xs);
        else if (width < 768) setColumns(COLUMNS.sm);
        else if (width < 1024) setColumns(COLUMNS.md);
        else if (width < 1280) setColumns(COLUMNS.lg);
        else setColumns(COLUMNS.xl);
      }
    };

    updateGridDimensions();
    window.addEventListener("resize", updateGridDimensions);
    return () => window.removeEventListener("resize", updateGridDimensions);
  }, []);

  // Initialize layout
  useEffect(() => {
    if (layout.length > 0) {
      setItems(layout);
    } else {
      // Create default layout if none exists
      const defaultLayout = bookmarks.map((bookmark, index) => ({
        id: bookmark.id,
        x: (index % columns) * 1,
        y: Math.floor(index / columns) * 1,
        w: 1,
        h: 1,
      }));
      setItems(defaultLayout);
    }
  }, [bookmarks, layout, columns]);

  // Set up drop target for the grid
  const [{ isOver }, drop] = useDrop({
    accept: "BOOKMARK_CARD",
    drop: (item, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      const { id } = item;

      // Find the dragged item
      const draggedItem = items.find((i) => i.id === id);
      if (!draggedItem) return;

      // Calculate new position
      let x = Math.round(draggedItem.x + delta.x / (GRID_SIZE * 6));
      let y = Math.round(draggedItem.y + delta.y / (GRID_SIZE * 6));

      // Ensure item stays within grid boundaries
      x = Math.max(0, Math.min(x, columns - 1));
      y = Math.max(0, Math.min(y, 20)); // Arbitrary max rows

      moveItem(id, x, y);
      return { id, x, y };
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  // Connect drop ref to grid ref
  drop(gridRef);

  // Move an item in the grid
  const moveItem = (id, x, y) => {
    setItems((prevItems) => {
      const newItems = prevItems.map((item) => {
        if (item.id === id) {
          return { ...item, x, y };
        }
        return item;
      });

      // Notify parent component of layout change
      onLayoutChange(newItems);
      return newItems;
    });
  };

  // Find a bookmark by its ID
  const getBookmark = (id) => {
    return bookmarks.find((bookmark) => bookmark.id === id);
  };

  // Calculate cell width based on grid width and number of columns
  const cellWidth = gridDimensions.width / columns;
  const cellHeight = cellWidth * 1.2; // Aspect ratio for cards

  return (
    <div
      ref={gridRef}
      className={`relative min-h-[600px] ${isOver ? "bg-gray-50 dark:bg-gray-800" : ""}`}
      style={{
        transition: "background-color 0.2s ease",
        backgroundImage: showGrid
          ? `linear-gradient(to right, rgba(159, 169, 183, 0.1) 1px, transparent 1px),
             linear-gradient(to bottom, rgba(159, 169, 183, 0.1) 1px, transparent 1px)`
          : "none",
        backgroundSize: `${cellWidth}px ${cellHeight}px`
      }}
    >
      {/* Grid visualization toggle */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`p-2 rounded-full ${
            showGrid
              ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300"
              : "bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400"
          } shadow-sm`}
          title="Toggle grid lines"
        >
          <FiMove className="w-4 h-4" />
        </button>
      </div>

      {/* Bookmark cards */}
      <AnimatePresence>
        {items.map((item) => {
          const bookmark = getBookmark(item.id);
          if (!bookmark) return null;

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute"
              style={{
                width: cellWidth,
                height: cellHeight,
                left: item.x * cellWidth,
                top: item.y * cellHeight,
                transition: "none",
              }}
            >
              <div className="p-1 h-full">
                <BoardCard
                  bookmark={bookmark}
                  draggable={true}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={() => setIsDragging(false)}
                  style={{ height: "100%" }}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default GridBoard;
