import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiCalendar,
  FiClock,
  FiPieChart,
  FiBarChart2,
  FiTrendingUp,
  FiTag,
  FiGlobe,
  FiStar,
  FiArchive,
  FiBookmark,
} from "react-icons/fi";
import { useBookmarkStats } from "../../hooks/useBookmarks";
import ActivityChart from "./ActivityChart";
import TagDistributionChart from "./TagDistributionChart";
import DomainChart from "./DomainChart";
import StatsCard from "./StatsCard";
import BookmarkTimeline from "./BookmarkTimeline";
import LoadingSpinner from "../LoadingSpinner";

const AnalyticsDashboard = () => {
  const [timeRange, setTimeRange] = useState("month");
  const [activeChart, setActiveChart] = useState("activity");
  const { data: stats, isLoading, isError, error } = useBookmarkStats();

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">
          Error loading bookmark statistics: {error?.message}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Analytics Dashboard
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Insights about your bookmarks and reading habits
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Bookmarks"
          value={stats?.total_bookmarks || 0}
          icon={<FiBookmark className="w-5 h-5" />}
          color="blue"
        />
        <StatsCard
          title="Favorite Bookmarks"
          value={stats?.favorite_bookmarks || 0}
          icon={<FiStar className="w-5 h-5" />}
          color="yellow"
        />
        <StatsCard
          title="Archived Bookmarks"
          value={stats?.archived_bookmarks || 0}
          icon={<FiArchive className="w-5 h-5" />}
          color="indigo"
        />
        <StatsCard
          title="Recent Activity"
          value={stats?.recent_activity_count || 0}
          icon={<FiClock className="w-5 h-5" />}
          color="green"
          subtitle="Last 7 days"
        />
      </div>

      {/* Chart Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 justify-between items-center">
          {/* Chart Type Selector */}
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveChart("activity")}
              className={`px-3 py-2 text-sm rounded-md flex items-center ${
                activeChart === "activity"
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <FiBarChart2 className="w-4 h-4 mr-2" />
              Activity
            </button>
            <button
              onClick={() => setActiveChart("tags")}
              className={`px-3 py-2 text-sm rounded-md flex items-center ${
                activeChart === "tags"
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <FiPieChart className="w-4 h-4 mr-2" />
              Tags
            </button>
            <button
              onClick={() => setActiveChart("domains")}
              className={`px-3 py-2 text-sm rounded-md flex items-center ${
                activeChart === "domains"
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <FiGlobe className="w-4 h-4 mr-2" />
              Domains
            </button>
            <button
              onClick={() => setActiveChart("timeline")}
              className={`px-3 py-2 text-sm rounded-md flex items-center ${
                activeChart === "timeline"
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <FiTrendingUp className="w-4 h-4 mr-2" />
              Timeline
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex space-x-1">
            <button
              onClick={() => handleTimeRangeChange("week")}
              className={`px-3 py-1 text-xs rounded-md ${
                timeRange === "week"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => handleTimeRangeChange("month")}
              className={`px-3 py-1 text-xs rounded-md ${
                timeRange === "month"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => handleTimeRangeChange("year")}
              className={`px-3 py-1 text-xs rounded-md ${
                timeRange === "year"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              Year
            </button>
            <button
              onClick={() => handleTimeRangeChange("all")}
              className={`px-3 py-1 text-xs rounded-md ${
                timeRange === "all"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {/* Chart Display */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 min-h-[400px]">
        {activeChart === "activity" && (
          <ActivityChart timeRange={timeRange} />
        )}
        {activeChart === "tags" && <TagDistributionChart />}
        {activeChart === "domains" && (
          <DomainChart domains={stats?.top_domains || []} />
        )}
        {activeChart === "timeline" && <BookmarkTimeline timeRange={timeRange} />}
      </div>

      {/* Additional insights - simple text-based insights */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <FiGlobe className="w-4 h-4 mr-2 text-blue-500" />
            Top Domains
          </h3>
          <div className="space-y-2">
            {stats?.top_domains?.slice(0, 5).map((domain, index) => (
              <div
                key={domain.domain || index}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {domain.domain || "Unknown"}
                </span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {domain.count} bookmark{domain.count !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
            {(!stats?.top_domains || stats.top_domains.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 italic text-sm py-2">
                No domain data available
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <FiTag className="w-4 h-4 mr-2 text-indigo-500" />
            Collection Stats
          </h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Collections
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats?.total_collections || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Tags
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats?.total_tags || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Avg. Per Collection
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats?.total_collections
                  ? Math.round(stats.total_bookmarks / stats.total_collections)
                  : 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AnalyticsDashboard;
