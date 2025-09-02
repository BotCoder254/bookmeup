import React from 'react';
import { motion } from 'framer-motion';
import { FiBookmark, FiStar, FiArchive, FiTag } from 'react-icons/fi';
import { useBookmarkStats } from '../../hooks';
import LoadingSpinner from '../LoadingSpinner';

const StatsCards = () => {
  const { data: stats, isLoading, isError } = useBookmarkStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6">
            <LoadingSpinner size="sm" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return null;
  }

  const cards = [
    {
      title: 'Total Bookmarks',
      value: stats?.total_bookmarks || 0,
      icon: FiBookmark,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    },
    {
      title: 'Favorites',
      value: stats?.favorite_bookmarks || 0,
      icon: FiStar,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    {
      title: 'Collections',
      value: stats?.total_collections || 0,
      icon: FiArchive,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      title: 'Tags',
      value: stats?.total_tags || 0,
      icon: FiTag,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.5 }}
          className="card card-hover p-6"
        >
          <div className="flex items-center">
            <div className={`p-3 rounded-lg ${card.bgColor}`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {card.title}
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {card.value.toLocaleString()}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsCards;