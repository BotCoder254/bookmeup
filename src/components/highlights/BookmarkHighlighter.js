import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FiBookmark, FiX, FiEdit3, FiTrash2, FiCheck } from "react-icons/fi";
import { toast } from "react-hot-toast";
import {
  useCreateHighlight,
  useUpdateHighlight,
  useDeleteHighlight,
} from "../../hooks/highlights";

const HIGHLIGHT_COLORS = [
  {
    id: "yellow",
    color: "#FFFF00",
    bg: "bg-yellow-200",
    hoverBg: "hover:bg-yellow-300",
  },
  {
    id: "green",
    color: "#ADFF2F",
    bg: "bg-green-200",
    hoverBg: "hover:bg-green-300",
  },
  {
    id: "blue",
    color: "#00BFFF",
    bg: "bg-blue-200",
    hoverBg: "hover:bg-blue-300",
  },
  {
    id: "purple",
    color: "#DDA0DD",
    bg: "bg-purple-200",
    hoverBg: "hover:bg-purple-300",
  },
  {
    id: "pink",
    color: "#FFB6C1",
    bg: "bg-pink-200",
    hoverBg: "hover:bg-pink-300",
  },
];

const DEFAULT_COLOR = HIGHLIGHT_COLORS[0].color;

const BookmarkHighlighter = ({
  bookmarkId,
  existingHighlights = [],
  contentRef,
  readOnly = false,
  onHighlightCreated,
  onHighlightUpdated,
  onHighlightDeleted,
}) => {
  const [selection, setSelection] = useState(null);
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [highlightNote, setHighlightNote] = useState("");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [isEditing, setIsEditing] = useState(false);
  const noteInputRef = useRef(null);

  const createHighlight = useCreateHighlight(bookmarkId);
  const updateHighlight = useUpdateHighlight();
  const deleteHighlight = useDeleteHighlight();

  // Apply existing highlights when component mounts or when they change
  useEffect(() => {
    if (contentRef.current && existingHighlights?.length > 0) {
      applyExistingHighlights();
    }
  }, [existingHighlights, contentRef.current]);

  // Handle text selection
  useEffect(() => {
    if (!readOnly) {
      document.addEventListener("mouseup", handleTextSelection);
      return () => document.removeEventListener("mouseup", handleTextSelection);
    }
  }, [readOnly, contentRef.current]);

  const handleTextSelection = () => {
    const selection = window.getSelection();

    // Only process selection if it's within our content area
    if (selection.rangeCount === 0 || !contentRef.current) return;

    const range = selection.getRangeAt(0);
    const container = contentRef.current;

    // Check if the selection is within our container
    if (!container.contains(range.commonAncestorContainer)) return;

    if (selection.toString().trim().length > 0) {
      // Get position data for storing highlight location
      const positionData = capturePositionData(range, container);

      setSelection({
        text: selection.toString(),
        range,
        positionData,
      });
    } else {
      setSelection(null);
    }
  };

  const capturePositionData = (range, container) => {
    // Enhanced implementation for robust highlight position tracking
    // Uses multiple strategies for resilience against DOM changes

    const startNode = range.startContainer;
    const endNode = range.endContainer;
    const selectedText = range.toString();

    // 1. XPath strategy - more resilient than CSS selectors in many cases
    const getXPath = (node, currentPath = "") => {
      // For text nodes, we need special handling
      if (node.nodeType === Node.TEXT_NODE) {
        // Get the index of this text node among its siblings
        let textNodeIndex = 0;
        let sibling = node.previousSibling;
        while (sibling) {
          if (sibling.nodeType === Node.TEXT_NODE) {
            textNodeIndex++;
          }
          sibling = sibling.previousSibling;
        }
        return `${getXPath(node.parentNode)}/text()[${textNodeIndex + 1}]`;
      }

      if (node === container) return "";

      if (!node.parentNode || node === document.body) {
        return currentPath;
      }

      // Get the index of the node among siblings with the same tag
      const siblings = Array.from(node.parentNode.childNodes).filter(
        (n) => n.nodeType === Node.ELEMENT_NODE && n.tagName === node.tagName,
      );

      const nodeIndex = siblings.indexOf(node) + 1;
      const tagName = node.tagName.toLowerCase();
      const indexPart = siblings.length > 1 ? `[${nodeIndex}]` : "";
      const currentPathSegment = `/${tagName}${indexPart}`;

      return getXPath(node.parentNode, currentPathSegment + currentPath);
    };

    // 2. CSS Selector strategy (improved version)
    const getCssSelector = (node) => {
      let path = [];
      let current = node;

      // If it's a text node, use the parent
      if (current.nodeType === Node.TEXT_NODE) {
        current = current.parentNode;
      }

      while (
        current !== container &&
        current !== document.body &&
        current.parentNode
      ) {
        const parent = current.parentNode;

        // Try to create a unique identifier for this element
        let identifier = current.tagName.toLowerCase();

        // Add ID if it exists
        if (current.id) {
          identifier += `#${current.id}`;
        }
        // Add classes if they exist
        else if (current.className && typeof current.className === "string") {
          const classes = current.className.trim().split(/\s+/);
          if (classes.length > 0) {
            identifier += `.${classes.join(".")}`;
          }
        }
        // Otherwise use nth-child for position
        else {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(current);
          if (index >= 0) {
            identifier += `:nth-child(${index + 1})`;
          }
        }

        path.unshift(identifier);
        current = parent;
      }

      return path.join(" > ");
    };

    // 3. Text content anchoring
    // Capture context before and after the selection for better matching
    const getTextContext = () => {
      // Function to get text content from parent element
      const getParentText = (node) => {
        // Find a suitable parent with enough text content
        let parent = node;
        while (
          parent !== container &&
          parent.textContent.length < Math.max(100, selectedText.length * 3)
        ) {
          if (parent.parentNode) {
            parent = parent.parentNode;
          } else {
            break;
          }
        }
        return parent.textContent || "";
      };

      const startParentText = getParentText(startNode);
      const startIndex = startParentText.indexOf(selectedText);

      // Get context before and after
      const contextBefore = startParentText.substring(
        Math.max(0, startIndex - 50),
        startIndex,
      );

      const contextAfter = startParentText.substring(
        startIndex + selectedText.length,
        Math.min(startParentText.length, startIndex + selectedText.length + 50),
      );

      return { contextBefore, contextAfter };
    };

    // Combine all strategies for maximum resilience
    return {
      // Primary strategies
      xpathStart: getXPath(startNode),
      xpathEnd: getXPath(endNode),
      cssSelector: getCssSelector(startNode.parentNode || startNode),

      // Secondary strategies (fallbacks)
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      textContent: selectedText,

      // Contextual information for fuzzy matching
      textContext: getTextContext(),

      // Store DOM structure information
      domStructure: {
        startNodeType: startNode.nodeType,
        endNodeType: endNode.nodeType,
        startParentTag: startNode.parentNode
          ? startNode.parentNode.tagName.toLowerCase()
          : null,
        endParentTag: endNode.parentNode
          ? endNode.parentNode.tagName.toLowerCase()
          : null,
      },

      // Original basic paths for backward compatibility
      startPath: getCssSelector(startNode),
      endPath: getCssSelector(endNode),
    };
  };

  const applyExistingHighlights = () => {
    // Remove any existing highlight spans to avoid duplication
    const container = contentRef.current;
    const existingSpans = container.querySelectorAll(".bookmark-highlight");
    existingSpans.forEach((span) => {
      // Unwrap the span by replacing it with its contents
      const parent = span.parentNode;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    });

    // Sort highlights by creation date to ensure consistent application order
    // (newer highlights should be applied after older ones in case of overlap)
    const sortedHighlights = [...existingHighlights].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at),
    );

    // Now apply all highlights
    sortedHighlights.forEach((highlight) => {
      try {
        applyHighlight(highlight);
      } catch (error) {
        console.error("Failed to apply highlight:", error);
        // Try alternative strategies if the primary one fails
        try {
          applyHighlightAlternative(highlight);
        } catch (fallbackError) {
          console.warn(
            "All highlight application methods failed:",
            fallbackError,
          );
        }
      }
    });
  };

  const applyHighlight = (highlight) => {
    // Robust implementation that uses position_data to accurately locate
    // and highlight text even when DOM structure has changed

    if (!highlight || !highlight.position_data || !contentRef.current) {
      console.warn("Invalid highlight data or missing position data");
      return;
    }

    const container = contentRef.current;
    const posData = highlight.position_data;

    try {
      // Strategy 1: Try XPath-based location (most precise)
      if (posData.xpathStart && posData.xpathEnd) {
        const evaluateXPath = (xpath, contextNode = document) => {
          try {
            return document.evaluate(
              xpath,
              contextNode,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null,
            ).singleNodeValue;
          } catch (e) {
            return null;
          }
        };

        const startNode = evaluateXPath(posData.xpathStart, container);
        const endNode = evaluateXPath(posData.xpathEnd, container);

        if (startNode && endNode) {
          const range = document.createRange();

          // Handle text nodes
          if (startNode.nodeType === Node.TEXT_NODE) {
            range.setStart(startNode, posData.startOffset || 0);
          } else {
            range.setStartBefore(startNode);
          }

          if (endNode.nodeType === Node.TEXT_NODE) {
            range.setEnd(
              endNode,
              posData.endOffset || endNode.textContent.length,
            );
          } else {
            range.setEndAfter(endNode);
          }

          highlightRange(range, highlight);
          return; // Success with XPath strategy
        }
      }

      // Strategy 2: Try CSS selector with text content verification
      if (posData.cssSelector) {
        const elements = container.querySelectorAll(posData.cssSelector);

        for (const element of elements) {
          if (element.textContent.includes(highlight.text)) {
            // Search within this element for the exact text
            const allTextNodes = getAllTextNodes(element);

            for (const node of allTextNodes) {
              const index = node.textContent.indexOf(highlight.text);
              if (index >= 0) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + highlight.text.length);
                highlightRange(range, highlight);
                return; // Success with CSS selector strategy
              }
            }
          }
        }
      }

      // Strategy 3: Use text context for fuzzy matching
      if (posData.textContext) {
        const { contextBefore, contextAfter } = posData.textContext;
        const allTextNodes = getAllTextNodes(container);

        for (const node of allTextNodes) {
          const fullText = node.textContent;
          // Look for contextBefore + highlightText + contextAfter pattern
          const pattern =
            (contextBefore || "") + highlight.text + (contextAfter || "");
          const fuzzyMatch = fullText.indexOf(pattern);

          if (fuzzyMatch >= 0) {
            const targetStart =
              fuzzyMatch + (contextBefore ? contextBefore.length : 0);
            const range = document.createRange();
            range.setStart(node, targetStart);
            range.setEnd(node, targetStart + highlight.text.length);
            highlightRange(range, highlight);
            return; // Success with context matching
          }
        }
      }

      // Fallback strategy: direct text search
      const allTextNodes = getAllTextNodes(container);
      for (const node of allTextNodes) {
        const index = node.textContent.indexOf(highlight.text);
        if (index >= 0) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + highlight.text.length);
          highlightRange(range, highlight);
          return; // Success with fallback
        }
      }

      // If we get here, all strategies failed
      console.warn("Could not locate highlight position:", highlight.text);
    } catch (error) {
      console.error("Error applying highlight:", error);
      throw error; // Allow caller to try alternative methods
    }
  };

  // Helper function to create highlight span for a range
  const highlightRange = (range, highlight) => {
    if (!range || range.collapsed) return;

    try {
      const span = document.createElement("span");
      span.className = "bookmark-highlight";
      span.style.backgroundColor = highlight.color || DEFAULT_COLOR;
      span.style.cursor = "pointer";
      span.dataset.highlightId = highlight.id;

      // Add click handler to show highlight details
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        setActiveHighlight(highlight);
        setHighlightNote(highlight.note || "");
        setSelectedColor(highlight.color || DEFAULT_COLOR);
        setIsEditing(false);
      });

      // Apply the highlight
      range.surroundContents(span);
    } catch (surroundError) {
      // Handle the case where surroundContents fails (e.g., when selection crosses element boundaries)
      console.warn("surroundContents failed, using alternative approach");

      // Extract contents and wrap them manually
      const contents = range.extractContents();
      const span = document.createElement("span");
      span.className = "bookmark-highlight";
      span.style.backgroundColor = highlight.color || DEFAULT_COLOR;
      span.style.cursor = "pointer";
      span.dataset.highlightId = highlight.id;

      span.appendChild(contents);
      range.insertNode(span);

      // Add click handler to show highlight details
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        setActiveHighlight(highlight);
        setHighlightNote(highlight.note || "");
        setSelectedColor(highlight.color || DEFAULT_COLOR);
        setIsEditing(false);
      });
    }
  };

  // Alternative approach using text content directly
  const applyHighlightAlternative = (highlight) => {
    const container = contentRef.current;
    const allTextNodes = getAllTextNodes(container);

    // Find exact text match or fuzzy match if needed
    const matchingNodes = allTextNodes.filter((node) => {
      // Try exact match first
      if (node.textContent.includes(highlight.text)) {
        return true;
      }

      // If no exact match, try fuzzy matching
      // Remove whitespace for fuzzy comparison
      const normalizedNodeText = node.textContent.replace(/\s+/g, " ").trim();
      const normalizedHighlightText = highlight.text
        .replace(/\s+/g, " ")
        .trim();
      return normalizedNodeText.includes(normalizedHighlightText);
    });

    for (const node of matchingNodes) {
      const text = node.textContent;
      let index = text.indexOf(highlight.text);

      // If exact match failed, try fuzzy match
      if (index < 0) {
        const normalizedNodeText = text.replace(/\s+/g, " ").trim();
        const normalizedHighlightText = highlight.text
          .replace(/\s+/g, " ")
          .trim();
        index = normalizedNodeText.indexOf(normalizedHighlightText);
      }

      if (index >= 0) {
        try {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + highlight.text.length);
          highlightRange(range, highlight);
          return; // Stop after first successful highlight
        } catch (e) {
          console.warn("Failed to apply alternative highlight:", e);
          continue; // Try next matching node
        }
      }
    }
  };

  const getAllTextNodes = (node) => {
    const allNodes = [];
    const walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      allNodes.push(currentNode);
    }

    return allNodes;
  };

  const createNewHighlight = () => {
    if (!selection) return;

    // Track the selection range before clearing it
    const selectionRange = selection.range.cloneRange();

    const highlightData = {
      bookmark: bookmarkId,
      text: selection.text,
      color: selectedColor,
      note: highlightNote,
      position_data: selection.positionData,
    };

    createHighlight.mutate(highlightData, {
      onSuccess: (data) => {
        // Apply the new highlight immediately for better user experience
        const newHighlight = {
          ...data,
          id: data.id, // Ensure we have the ID from the server
        };

        try {
          // Create highlight span
          const span = document.createElement("span");
          span.className = "bookmark-highlight";
          span.style.backgroundColor = selectedColor;
          span.style.cursor = "pointer";
          span.dataset.highlightId = newHighlight.id;

          // Apply the highlight to the previously saved range
          try {
            selectionRange.surroundContents(span);
          } catch (surroundError) {
            // Handle the case where surroundContents fails
            console.warn(
              "surroundContents failed during creation, using alternative approach",
              surroundError,
            );

            // Extract contents and wrap them manually
            const contents = selectionRange.extractContents();
            span.appendChild(contents);
            selectionRange.insertNode(span);
          }

          // Add click handler to show highlight details
          span.addEventListener("click", (e) => {
            e.stopPropagation();
            setActiveHighlight(newHighlight);
            setHighlightNote(newHighlight.note || "");
            setSelectedColor(newHighlight.color || DEFAULT_COLOR);
            setIsEditing(false);
          });
        } catch (error) {
          console.warn("Failed to apply highlight immediately:", error);
          // Don't worry if this fails, the highlight will be applied on next render
        }

        if (onHighlightCreated) {
          onHighlightCreated(newHighlight);
        }

        // Clear selection
        window.getSelection().removeAllRanges();
        setSelection(null);
        setHighlightNote("");
      },
      onError: (error) => {
        console.error("Failed to create highlight:", error);
        toast.error("Failed to save highlight. Please try again.");
      },
    });
  };

  const updateExistingHighlight = () => {
    if (!activeHighlight) return;

    const updatedData = {
      id: activeHighlight.id,
      bookmarkId: bookmarkId,
      color: selectedColor,
      note: highlightNote,
    };

    updateHighlight.mutate(updatedData, {
      onSuccess: (data) => {
        // Update the highlight in the UI
        const updatedHighlight = {
          ...activeHighlight,
          color: selectedColor,
          note: highlightNote,
        };

        if (onHighlightUpdated) {
          onHighlightUpdated(updatedHighlight);
        }

        setActiveHighlight(null);
        setIsEditing(false);
      },
    });
  };

  const removeHighlight = () => {
    if (!activeHighlight) return;

    deleteHighlight.mutate(
      {
        id: activeHighlight.id,
        bookmarkId: bookmarkId,
      },
      {
        onSuccess: () => {
          if (onHighlightDeleted) {
            onHighlightDeleted(activeHighlight.id);
          }

          setActiveHighlight(null);
        },
      },
    );
  };

  // Render the selection popover
  const SelectionPopover = () => {
    if (!selection) return null;

    // Calculate position based on selection
    const range = selection.range;
    const rect = range.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();

    const top = rect.top - containerRect.top - 50; // Position above the selection
    const left = rect.left - containerRect.left + rect.width / 2; // Centered horizontally

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 border border-gray-200 dark:border-gray-700"
        style={{
          top: `${top}px`,
          left: `${left}px`,
          transform: "translateX(-50%)", // Center horizontally
          width: "250px",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Highlight Text
          </h4>
          <button
            onClick={() => {
              window.getSelection().removeAllRanges();
              setSelection(null);
            }}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-3">
          <div className="flex space-x-2 mb-3">
            {HIGHLIGHT_COLORS.map((colorOption) => (
              <button
                key={colorOption.id}
                className={`w-6 h-6 rounded-full border border-gray-300 ${
                  selectedColor === colorOption.color
                    ? "ring-2 ring-offset-2 ring-indigo-500"
                    : ""
                }`}
                style={{ backgroundColor: colorOption.color }}
                onClick={() => setSelectedColor(colorOption.color)}
                aria-label={`Select ${colorOption.id} highlight color`}
              />
            ))}
          </div>

          <textarea
            className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-md"
            placeholder="Add a note (optional)"
            rows="3"
            value={highlightNote}
            onChange={(e) => setHighlightNote(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={createNewHighlight}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md flex items-center"
          >
            <FiBookmark className="w-3.5 h-3.5 mr-1.5" />
            Highlight
          </button>
        </div>
      </motion.div>
    );
  };

  // Render the active highlight popover
  const HighlightPopover = () => {
    if (!activeHighlight) return null;

    // Find the highlight element in the DOM to position the popover
    const highlightEl = contentRef.current.querySelector(
      `.bookmark-highlight[data-highlight-id="${activeHighlight.id}"]`,
    );

    if (!highlightEl) return null;

    const rect = highlightEl.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();

    const top = rect.bottom - containerRect.top + 10; // Position below the highlight
    const left = rect.left - containerRect.left + rect.width / 2; // Centered horizontally

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 border border-gray-200 dark:border-gray-700"
        style={{
          top: `${top}px`,
          left: `${left}px`,
          transform: "translateX(-50%)", // Center horizontally
          width: "250px",
        }}
      >
        {isEditing ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Edit Highlight
              </h4>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setHighlightNote(activeHighlight.note || "");
                  setSelectedColor(activeHighlight.color || DEFAULT_COLOR);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-3">
              <div className="flex space-x-2 mb-3">
                {HIGHLIGHT_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.id}
                    className={`w-6 h-6 rounded-full border border-gray-300 ${
                      selectedColor === colorOption.color
                        ? "ring-2 ring-offset-2 ring-indigo-500"
                        : ""
                    }`}
                    style={{ backgroundColor: colorOption.color }}
                    onClick={() => setSelectedColor(colorOption.color)}
                    aria-label={`Select ${colorOption.id} highlight color`}
                  />
                ))}
              </div>

              <textarea
                ref={noteInputRef}
                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-md"
                placeholder="Add a note (optional)"
                rows="3"
                value={highlightNote}
                onChange={(e) => setHighlightNote(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setHighlightNote(activeHighlight.note || "");
                }}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm rounded-md flex items-center"
              >
                Cancel
              </button>
              <button
                onClick={updateExistingHighlight}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md flex items-center"
              >
                <FiCheck className="w-3.5 h-3.5 mr-1.5" />
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: activeHighlight.color || DEFAULT_COLOR,
                }}
              />
              <div className="flex space-x-1">
                {!readOnly && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      // Focus on the note textarea after rendering
                      setTimeout(() => {
                        if (noteInputRef.current) {
                          noteInputRef.current.focus();
                        }
                      }, 0);
                    }}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    aria-label="Edit highlight"
                  >
                    <FiEdit3 className="w-4 h-4" />
                  </button>
                )}
                {!readOnly && (
                  <button
                    onClick={removeHighlight}
                    className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    aria-label="Delete highlight"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setActiveHighlight(null)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  aria-label="Close"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <p className="text-sm text-gray-800 dark:text-gray-200 italic mb-2">
                "{activeHighlight.text}"
              </p>

              {activeHighlight.note && (
                <div className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                  <p className="text-gray-700 dark:text-gray-300">
                    {activeHighlight.note}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    );
  };

  return (
    <>
      {selection && <SelectionPopover />}
      {activeHighlight && <HighlightPopover />}
    </>
  );
};

export default BookmarkHighlighter;
