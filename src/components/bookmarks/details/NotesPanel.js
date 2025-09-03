import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiEdit2, FiSave, FiX, FiClock, FiEye } from "react-icons/fi";
import { apiClient } from "../../../utils/api";
import { formatDate } from "../../../utils";

const NotesPanel = ({ bookmarkId }) => {
  const [notes, setNotes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (bookmarkId) {
      fetchNotes();
    }
  }, [bookmarkId]);

  const fetchNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the GET method to fetch notes
      const response = await apiClient.getBookmarkNotes(bookmarkId);
      setNotes(response.results || []);

      // Set the current active note content if available
      const activeNote = response.results?.find((n) => n.is_active);
      if (activeNote) {
        setContent(activeNote.content);
      } else {
        // Try to get legacy notes from the bookmark itself
        const bookmark = await apiClient.getBookmark(bookmarkId);
        if (bookmark.notes) {
          setContent(bookmark.notes);
        }
      }
    } catch (err) {
      console.error("Error fetching notes:", err);
      setError("Could not load notes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = async () => {
    if (!content.trim()) {
      // If no content, don't save
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      // Use the saveBookmarkNote method from apiClient
      await apiClient.saveBookmarkNote(bookmarkId, {
        content,
        // The backend handles sanitization and plaintext extraction
      });

      await fetchNotes(); // Refresh notes
      setIsEditing(false);
    } catch (err) {
      console.error("Error saving note:", err);
      setError("Could not save note. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewRevision = (noteId) => {
    const revision = notes.find((n) => n.id === noteId);
    if (revision) {
      setContent(revision.content);
      // Just view, don't save automatically
    }
  };

  const cancelEdit = () => {
    // Revert to the active note content
    const activeNote = notes.find((n) => n.is_active);
    if (activeNote) {
      setContent(activeNote.content);
    }
    setIsEditing(false);
  };

  // Handle markdown-like shortcuts during editing
  const handleKeyDown = (e) => {
    // Example: Tab key for indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;

      const newContent =
        content.substring(0, start) + "  " + content.substring(end);
      setContent(newContent);

      // Set cursor position after indentation
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  if (isLoading && notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">
          Loading notes...
        </div>
      </div>
    );
  }

  if (error && notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="text-red-500 mb-3">{error}</div>
        <button
          onClick={fetchNotes}
          className="px-4 py-2 bg-primary-100 hover:bg-primary-200 dark:bg-primary-900 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300 rounded-md text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Notes Content */}
      <div className="flex-1 overflow-auto mb-4">
        {isEditing ? (
          <div className="h-full">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-full min-h-[200px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              placeholder="Add your notes here..."
              autoFocus
            />
          </div>
        ) : content ? (
          <div
            className="prose dark:prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div className="text-gray-500 dark:text-gray-400 text-center py-8">
            No notes yet. Click the edit button to add notes.
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div>
          {notes.length > 1 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <FiClock className="w-4 h-4 mr-1" />
              <span>{showHistory ? "Hide history" : "Show history"}</span>
            </button>
          )}
        </div>

        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={cancelEdit}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                disabled={isLoading}
              >
                <FiX className="w-5 h-5" />
              </button>
              <button
                onClick={saveNote}
                className="flex items-center space-x-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving
                  </span>
                ) : (
                  <>
                    <FiSave className="w-4 h-4" />
                    <span>Save</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
            >
              <FiEdit2 className="w-4 h-4" />
              <span>Edit Notes</span>
            </button>
          )}
        </div>
      </div>

      {/* Revision History */}
      {showHistory && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3"
        >
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Revision History
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {notes
              .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
              .map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-md"
                >
                  <div className="flex items-center">
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatDate(note.updated_at)}
                    </span>
                    {note.is_active && (
                      <span className="ml-2 px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleViewRevision(note.id)}
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center"
                  >
                    <FiEye className="w-4 h-4 mr-1" />
                    <span>View</span>
                  </button>
                </div>
              ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default NotesPanel;
