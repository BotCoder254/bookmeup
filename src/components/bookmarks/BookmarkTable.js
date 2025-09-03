import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  FiStar,
  FiArchive,
  FiExternalLink,
  FiMoreVertical,
  FiFolder,
  FiClock,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";
import {
  useInfiniteBookmarks,
  useToggleFavorite,
  useToggleArchive,
  useVisitBookmark,
} from "../../hooks";
import {
  formatDate,
  extractDomain,
  getFaviconUrl,
  truncateText,
} from "../../utils";
import { BookmarkDetail } from "./details";

const BookmarkTable = ({
  searchQuery = "",
  activeView = { type: "all" },
  className = "",
}) => {
  const filters = useMemo(() => {
    const newFilters = {};

    if (searchQuery) {
      newFilters.search = searchQuery;
    }

    if (activeView?.type === "favorites") {
      newFilters.is_favorite = true;
    } else if (activeView?.type === "archived") {
      newFilters.is_archived = true;
    } else if (activeView?.type === "collection" && activeView?.id) {
      newFilters.collection = activeView.id;
    } else if (activeView?.type === "tag" && activeView?.id) {
      newFilters.tags = [activeView.id];
    }

    return newFilters;
  }, [searchQuery, activeView]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteBookmarks(filters);
  const toggleFavorite = useToggleFavorite();
  const toggleArchive = useToggleArchive();
  const visitBookmark = useVisitBookmark();
  const [selectedBookmark, setSelectedBookmark] = useState(null);

  const bookmarks = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.results || []);
  }, [data]);

  const columns = useMemo(
    () => [
      {
        id: "favicon",
        header: "",
        cell: ({ row }) => {
          const bookmark = row.original;
          const faviconUrl = getFaviconUrl(bookmark.url);
          return (
            <div className="w-8 h-8 flex items-center justify-center">
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className="w-6 h-6 rounded"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center"
                style={{ display: faviconUrl ? "none" : "flex" }}
              >
                <FiExternalLink className="w-3 h-3 text-gray-500" />
              </div>
            </div>
          );
        },
        size: 50,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          const bookmark = row.original;
          const domain = extractDomain(bookmark.url);
          return (
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {bookmark.title || domain}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {domain}
              </p>
            </div>
          );
        },
        minSize: 200,
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const bookmark = row.original;
          return bookmark.description ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {truncateText(bookmark.description, 100)}
            </p>
          ) : (
            <span className="text-gray-400 italic">No description</span>
          );
        },
        minSize: 200,
      },
      {
        accessorKey: "tags",
        header: "Tags",
        cell: ({ row }) => {
          const bookmark = row.original;
          return (
            <div className="flex flex-wrap gap-1">
              {bookmark.tags?.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  style={{
                    backgroundColor: tag.color + "20",
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
              ))}
              {bookmark.tags?.length > 3 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  +{bookmark.tags.length - 3}
                </span>
              )}
            </div>
          );
        },
        minSize: 150,
      },
      {
        accessorKey: "collection",
        header: "Collection",
        cell: ({ row }) => {
          const bookmark = row.original;
          return bookmark.collection__name ? (
            <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
              <FiFolder className="w-3 h-3" />
              <span className="truncate">{bookmark.collection__name}</span>
            </div>
          ) : (
            <span className="text-gray-400 italic">None</span>
          );
        },
        size: 120,
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => {
          const bookmark = row.original;
          return (
            <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
              <FiClock className="w-3 h-3" />
              <span>{formatDate(bookmark.created_at)}</span>
            </div>
          );
        },
        size: 100,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const bookmark = row.original;

          const handleFavoriteToggle = (e) => {
            e.stopPropagation();
            toggleFavorite.mutate(bookmark.id);
          };

          const handleVisit = () => {
            visitBookmark.mutate(bookmark.id);
            window.open(bookmark.url, "_blank");
          };

          return (
            <div className="flex items-center space-x-2">
              {bookmark.is_archived && (
                <FiArchive className="w-4 h-4 text-gray-400" />
              )}
              <button
                onClick={handleFavoriteToggle}
                className={`p-1 rounded transition-colors ${
                  bookmark.is_favorite
                    ? "text-yellow-500 hover:text-yellow-600"
                    : "text-gray-400 hover:text-yellow-500"
                }`}
              >
                <FiStar
                  className={`w-4 h-4 ${bookmark.is_favorite ? "fill-current" : ""}`}
                />
              </button>
              <button
                onClick={handleVisit}
                className="p-1 rounded text-gray-400 hover:text-primary-600 transition-colors"
              >
                <FiExternalLink className="w-4 h-4" />
              </button>
            </div>
          );
        },
        size: 100,
      },
    ],
    [toggleFavorite, visitBookmark],
  );

  const table = useReactTable({
    data: bookmarks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (bookmarks.length === 0) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {searchQuery
              ? "No bookmarks found matching your search."
              : "No bookmarks yet. Add your first one!"}
          </p>
        </div>
      </div>
    );
  }

  const handleShowDetail = (bookmark) => {
    setSelectedBookmark(bookmark);
  };

  const handleCloseDetail = () => {
    setSelectedBookmark(null);
  };

  return (
    <div className={`${className}`}>
      <div className="overflow-hidden bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center space-x-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() && (
                          <span className="ml-1">
                            {header.column.getIsSorted() === "desc" ? (
                              <FiArrowDown className="w-3 h-3" />
                            ) : (
                              <FiArrowUp className="w-3 h-3" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {table.getRowModel().rows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.01, duration: 0.2 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => {
                    handleShowDetail(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-6 py-4 whitespace-nowrap"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Load More Button */}
        {hasNextPage && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full btn btn-secondary flex items-center justify-center space-x-2"
            >
              {isFetchingNextPage ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <span>Load More</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bookmark Detail Panel */}
      <AnimatePresence>
        {selectedBookmark && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <div
              className="absolute inset-0 bg-black bg-opacity-30"
              onClick={handleCloseDetail}
            />
            <div className="relative w-full max-w-2xl">
              <BookmarkDetail
                bookmark={selectedBookmark}
                onClose={handleCloseDetail}
                onEdit={() => {}}
                isMobile={false}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookmarkTable;
