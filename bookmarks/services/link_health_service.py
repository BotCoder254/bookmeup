"""
Link Health Service
Provides services for checking and maintaining link health in the background
"""

from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q
import logging
import time
import random

from ..models import Bookmark, LinkHealth
from ..link_health import LinkHealthChecker

logger = logging.getLogger(__name__)

class LinkHealthService:
    """Service for processing link health checks in the background"""

    def __init__(self, batch_size=50, max_workers=5):
        self.checker = LinkHealthChecker(max_workers=max_workers)
        self.batch_size = batch_size

    def get_bookmarks_for_checking(self, user_id=None, limit=None):
        """
        Get bookmarks that need health checking

        Args:
            user_id (int, optional): Filter by user ID
            limit (int, optional): Limit the number of bookmarks to check

        Returns:
            list: List of Bookmark objects due for health checking
        """
        now = timezone.now()
        base_query = Bookmark.objects.all()

        if user_id:
            base_query = base_query.filter(user_id=user_id)

        # Filter for bookmarks that don't have a health record yet
        missing_health = base_query.filter(health__isnull=True)

        # Filter for bookmarks that need checking (next_check time has passed)
        needs_checking = base_query.filter(
            Q(health__isnull=False) &
            (Q(health__next_check__lte=now) | Q(health__status='pending'))
        )

        # Combine queries - missing health records take priority
        all_bookmarks = list(missing_health[:self.batch_size])

        remaining_slots = self.batch_size - len(all_bookmarks)
        if remaining_slots > 0:
            all_bookmarks.extend(list(needs_checking[:remaining_slots]))

        # Apply overall limit if specified
        if limit and len(all_bookmarks) > limit:
            all_bookmarks = all_bookmarks[:limit]

        # Shuffle to avoid always checking the same bookmarks first
        random.shuffle(all_bookmarks)

        return all_bookmarks

    def process_due_bookmarks(self, user_id=None, limit=None):
        """
        Check health for bookmarks that are due for checking

        Args:
            user_id (int, optional): Filter by user ID
            limit (int, optional): Limit the number of bookmarks to check

        Returns:
            list: List of updated LinkHealth objects
        """
        bookmarks = self.get_bookmarks_for_checking(user_id=user_id, limit=limit)

        if not bookmarks:
            logger.info("No bookmarks due for health checking")
            return []

        logger.info(f"Checking health for {len(bookmarks)} bookmarks")
        results = []

        # Process bookmarks in batches
        for i in range(0, len(bookmarks), self.batch_size):
            batch = bookmarks[i:i+self.batch_size]
            batch_results = self.checker.check_bookmarks(batch)
            results.extend(batch_results)

            # Small delay between batches to avoid overwhelming servers
            if i + self.batch_size < len(bookmarks):
                time.sleep(2)

        logger.info(f"Completed health checks for {len(results)} bookmarks")
        return results

    def check_archived_versions(self, user_id=None, limit=100):
        """
        Find archived versions for broken links

        Args:
            user_id (int, optional): Filter by user ID
            limit (int, optional): Limit the number of bookmarks to check

        Returns:
            int: Number of bookmarks updated with archive URLs
        """
        # Get broken links without archive URLs
        query = LinkHealth.objects.filter(status='broken', archive_url__isnull=True)

        if user_id:
            query = query.filter(bookmark__user_id=user_id)

        broken_links = query.select_related('bookmark')[:limit]

        updated_count = 0
        for health in broken_links:
            try:
                archive_url = self.checker.check_web_archive(health.bookmark.url)
                if archive_url:
                    health.archive_url = archive_url
                    health.save(update_fields=['archive_url'])
                    updated_count += 1

                    # Small delay to avoid overwhelming archive.org
                    time.sleep(1)
            except Exception as e:
                logger.error(f"Error checking archive for {health.bookmark.url}: {e}")

        return updated_count

def run_link_health_check(user_id=None, limit=50):
    """
    Run link health check for user's bookmarks

    Args:
        user_id (int, optional): User ID to check bookmarks for
        limit (int, optional): Maximum number of bookmarks to check

    Returns:
        list: List of updated LinkHealth objects
    """
    service = LinkHealthService()
    return service.process_due_bookmarks(user_id=user_id, limit=limit)

def get_bookmark_health_summary(user_id=None):
    """
    Get summary statistics for bookmark health

    Args:
        user_id (int, optional): User ID to get statistics for

    Returns:
        dict: Dictionary with health statistics
    """
    query = LinkHealth.objects.all()

    if user_id:
        query = query.filter(bookmark__user_id=user_id)

    # Get counts by status
    total_count = query.count()
    ok_count = query.filter(status='ok').count()
    redirected_count = query.filter(status='redirected').count()
    broken_count = query.filter(status='broken').count()
    pending_count = query.filter(status='pending').count()
    archived_count = query.filter(archive_url__isnull=False).exclude(archive_url='').count()

    # Calculate percentage of healthy links
    healthy_percent = 0
    if total_count > 0:
        healthy_percent = round((ok_count / total_count) * 100)

    # Get counts of bookmarks without health records
    no_health_count = 0
    if user_id:
        no_health_count = Bookmark.objects.filter(
            user_id=user_id,
            health__isnull=True
        ).count()

    return {
        'total': total_count,
        'ok': ok_count,
        'redirected': redirected_count,
        'broken': broken_count,
        'pending': pending_count,
        'archived': archived_count,
        'healthy_percent': healthy_percent,
        'no_health_records': no_health_count
    }
