import React from "react";
import {
  FiClock,
  FiFolder,
  FiEye,
  FiCalendar,
  FiLink,
  FiAlertCircle,
  FiCheckCircle,
  FiRotateCw,
} from "react-icons/fi";
import { formatDate, formatDateTime } from "../../../utils/api";

const MetadataPanel = ({ bookmark }) => {
  const renderMetadataItem = (icon, label, value) => (
    <div className="flex items-center text-sm">
      <div className="mr-2 text-gray-400">{icon}</div>
      <div className="mr-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {label}:
      </div>
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
            formatDate(bookmark.created_at),
          )}

        {bookmark.visited_at &&
          renderMetadataItem(
            <FiEye className="w-4 h-4" />,
            "Last visited",
            formatDateTime(bookmark.visited_at),
          )}

        {bookmark.updated_at &&
          renderMetadataItem(
            <FiClock className="w-4 h-4" />,
            "Updated",
            formatDateTime(bookmark.updated_at),
          )}

        {(bookmark.collection_name ||
          (bookmark.collection && bookmark.collection.name)) &&
          renderMetadataItem(
            <FiFolder className="w-4 h-4" />,
            "Collection",
            bookmark.collection_name || bookmark.collection.name,
          )}

        {bookmark.domain &&
          renderMetadataItem(
            <FiLink className="w-4 h-4" />,
            "Domain",
            bookmark.domain,
          )}

        {bookmark.health_status &&
          renderMetadataItem(
            getHealthIcon(bookmark.health_status.status),
            "Link Status",
            getHealthLabel(bookmark.health_status),
          )}
      </div>
    </div>
  );
};

// Helper functions for link health status
const getHealthIcon = (status) => {
  switch (status) {
    case "ok":
      return <FiCheckCircle className="w-4 h-4 text-green-500" />;
    case "redirected":
      return <FiRotateCw className="w-4 h-4 text-yellow-500" />;
    case "broken":
      return <FiAlertCircle className="w-4 h-4 text-red-500" />;
    case "archived":
      return <FiLink className="w-4 h-4 text-blue-500" />;
    default:
      return <FiLink className="w-4 h-4" />;
  }
};

const getHealthLabel = (healthStatus) => {
  switch (healthStatus.status) {
    case "ok":
      return "Healthy";
    case "redirected":
      return "Redirected";
    case "broken":
      return "Broken";
    case "archived":
      return "Archived";
    case "pending":
      return "Pending Check";
    default:
      return "Unknown";
  }
};

export default MetadataPanel;
