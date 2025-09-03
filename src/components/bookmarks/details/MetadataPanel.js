import React from "react";
import { FiClock, FiFolder, FiEye, FiCalendar, FiLink } from "react-icons/fi";
import { formatDate, formatDateTime } from "../../../utils/api";

const MetadataPanel = ({ bookmark }) => {
  const renderMetadataItem = (icon, label, value) => (
    <div className="flex items-center text-sm">
      <div className="mr-2 text-gray-400">{icon}</div>
      <div className="mr-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{label}:</div>
      <div className="text-gray-700 dark:text-gray-300 truncate">{value}</div>
    </div>
  );

  return (
    <div className="py-2 space-y-3">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
        Details
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {bookmark.created_at &&
          renderMetadataItem(
            <FiCalendar className="w-4 h-4" />,
            "Added",
            formatDate(bookmark.created_at)
          )}

        {bookmark.visited_at &&
          renderMetadataItem(
            <FiEye className="w-4 h-4" />,
            "Last visited",
            formatDateTime(bookmark.visited_at)
          )}

        {bookmark.updated_at &&
          renderMetadataItem(
            <FiClock className="w-4 h-4" />,
            "Updated",
            formatDateTime(bookmark.updated_at)
          )}

        {(bookmark.collection_name || (bookmark.collection && bookmark.collection.name)) &&
          renderMetadataItem(
            <FiFolder className="w-4 h-4" />,
            "Collection",
            bookmark.collection_name || bookmark.collection.name
          )}

        {bookmark.domain &&
          renderMetadataItem(
            <FiLink className="w-4 h-4" />,
            "Domain",
            bookmark.domain
          )}
      </div>
    </div>
  );
};

export default MetadataPanel;
