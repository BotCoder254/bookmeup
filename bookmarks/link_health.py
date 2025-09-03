"""
Link Health Checker for BookMeUp
- Checks bookmarked links for health status (OK, redirected, broken)
- Provides archive.org fallbacks for broken links
- Supports auto-repair of redirects and suggestions for broken links
"""

import requests
from datetime import datetime, timedelta
import time
import logging
from urllib.parse import urlparse, quote
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from concurrent.futures import ThreadPoolExecutor
from .models import Bookmark, LinkHealth, BookmarkActivity

logger = logging.getLogger(__name__)

# Constants
DEFAULT_TIMEOUT = 10  # seconds
DEFAULT_MAX_REDIRECTS = 5
USER_AGENT = 'Mozilla/5.0 (compatible; BookMeUp-LinkChecker/1.0; +https://bookmeup.io)'
WEB_ARCHIVE_URL = 'https://web.archive.org'
BATCH_SIZE = 50  # Process 50 bookmarks at a time


class LinkHealthChecker:
    """Utility class for checking link health"""

    def __init__(self, max_workers=5):
        self.timeout = getattr(settings, 'LINK_CHECK_TIMEOUT', DEFAULT_TIMEOUT)
        self.max_redirects = getattr(settings, 'LINK_CHECK_MAX_REDIRECTS', DEFAULT_MAX_REDIRECTS)
        self.max_workers = max_workers
        self.headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }

    def check_url(self, url):
        """
        Check a URL's health

        Returns a dict with:
        - status: 'ok', 'redirected', 'broken'
        - status_code: HTTP status code
        - final_url: URL after redirects
        - response_time: response time in ms
        - error: error message if any
        """
        start_time = time.time()
        result = {
            'status': 'broken',
            'status_code': None,
            'final_url': None,
            'response_time': None,
            'error': None,
            'archive_url': None
        }

        try:
            response = requests.head(
                url,
                headers=self.headers,
                timeout=self.timeout,
                allow_redirects=True,
                max_redirects=self.max_redirects
            )

            # Calculate response time
            response_time = int((time.time() - start_time) * 1000)

            # Check if final URL is different from original
            is_redirected = response.url != url

            result.update({
                'status': 'redirected' if is_redirected else 'ok',
                'status_code': response.status_code,
                'final_url': response.url,
                'response_time': response_time
            })

            # For certain status codes, we still consider the link broken
            if response.status_code >= 400:
                result['status'] = 'broken'
                result['error'] = f'HTTP {response.status_code}'

        except requests.exceptions.RequestException as e:
            result.update({
                'status': 'broken',
                'error': str(e),
                'response_time': int((time.time() - start_time) * 1000)
            })

        # If broken, check archive.org
        if result['status'] == 'broken':
            archive_url = self._check_web_archive(url)
            if archive_url:
                result['archive_url'] = archive_url
                # If we have an archive, update status to indicate that
                result['status'] = 'archived'

        return result

    def _check_web_archive(self, url):
        """Check if URL is available in Web Archive"""
        try:
            # First check if the URL is available in the archive
            archive_api_url = f"{WEB_ARCHIVE_URL}/wayback/available?url={quote(url)}"
            response = requests.get(
                archive_api_url,
                headers=self.headers,
                timeout=self.timeout
            )

            if response.status_code == 200:
                data = response.json()
                if data['archived_snapshots'].get('closest', {}).get('available'):
                    return data['archived_snapshots']['closest']['url']

            return None
        except Exception as e:
            logger.error(f"Error checking web archive for {url}: {e}")
            return None

    def process_bookmark(self, bookmark):
        """Check health of a bookmark and update its LinkHealth record"""
        try:
            # Check if bookmark already has a LinkHealth record
            try:
                health = bookmark.health
            except LinkHealth.DoesNotExist:
                # Create new LinkHealth record if it doesn't exist
                health = LinkHealth(bookmark=bookmark)

            # Check the URL
            result = self.check_url(bookmark.url)

            # Update health record
            health.status = result['status']
            health.last_checked = timezone.now()
            health.final_url = result['final_url']
            health.status_code = result['status_code']
            health.response_time = result['response_time']
            health.error_message = result['error'] or ''
            health.archive_url = result['archive_url']
            health.check_count += 1

            # Calculate next check time
            health.update_next_check_time()

            # Save the health record
            health.save()

            return health
        except Exception as e:
            logger.error(f"Error processing bookmark {bookmark.id}: {e}")
            return None

    def process_batch(self, bookmarks):
        """Process a batch of bookmarks in parallel"""
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            results = list(executor.map(self.process_bookmark, bookmarks))
        return results

    def get_bookmarks_for_checking(self, user_id=None, limit=BATCH_SIZE):
        """Get bookmarks that need to be checked"""
        now = timezone.now()

        # Start with bookmarks that have never been checked (no LinkHealth record)
        unchecked_bookmarks = Bookmark.objects.filter(
            health__isnull=True
        )

        # If user_id provided, filter to that user's bookmarks
        if user_id:
            unchecked_bookmarks = unchecked_bookmarks.filter(user_id=user_id)

        # Filter out archived bookmarks
        unchecked_bookmarks = unchecked_bookmarks.filter(is_archived=False)

        # Limit the number of bookmarks
        unchecked_bookmarks = unchecked_bookmarks[:limit]

        # If we didn't fill our quota, add bookmarks due for rechecking
        if unchecked_bookmarks.count() < limit:
            remaining = limit - unchecked_bookmarks.count()

            # Get bookmarks with existing health checks that are due
            recheck_bookmarks = Bookmark.objects.filter(
                health__next_check__lte=now,
                is_archived=False
            )

            if user_id:
                recheck_bookmarks = recheck_bookmarks.filter(user_id=user_id)

            # Order by priority: broken first, then redirected, then ok
            recheck_bookmarks = recheck_bookmarks.order_by(
                # Priority based on status (broken > redirected > ok)
                # and last_checked (oldest first)
                'health__status',  # broken first
                'health__last_checked'
            )[:remaining]

            # Combine the two querysets
            bookmarks_to_check = list(unchecked_bookmarks) + list(recheck_bookmarks)
        else:
            bookmarks_to_check = list(unchecked_bookmarks)

        return bookmarks_to_check

    def run_check_batch(self, user_id=None, limit=BATCH_SIZE):
        """Run a batch of link health checks"""
        bookmarks = self.get_bookmarks_for_checking(user_id, limit)

        if not bookmarks:
            logger.info("No bookmarks need checking at this time")
            return []

        logger.info(f"Checking {len(bookmarks)} bookmarks for link health")
        results = self.process_batch(bookmarks)

        return results


class LinkHealthRepair:
    """Utility class for repairing broken or redirected links"""

    def __init__(self):
        pass

    @transaction.atomic
    def apply_redirect(self, bookmark_id, user_id):
        """
        Update a bookmark's URL to its final redirect location

        Args:
            bookmark_id: ID of the bookmark to update
            user_id: ID of the user performing the action

        Returns:
            Updated bookmark or None if failed
        """
        try:
            bookmark = Bookmark.objects.get(id=bookmark_id)
            health = LinkHealth.objects.get(bookmark_id=bookmark_id)

            if health.status != 'redirected' or not health.final_url:
                raise ValueError("Bookmark is not redirected or has no final URL")

            # Store original URL for history
            original_url = bookmark.url

            # Update bookmark URL
            bookmark.url = health.final_url
            bookmark.save()

            # Update health status
            health.status = 'ok'
            health.last_checked = timezone.now()
            health.update_next_check_time()
            health.save()

            # Log activity
            BookmarkActivity.objects.create(
                bookmark=bookmark,
                user_id=user_id,
                activity_type='updated',
                metadata={
                    'action': 'repair_redirect',
                    'original_url': original_url,
                    'new_url': health.final_url
                }
            )

            return bookmark
        except Exception as e:
            logger.error(f"Error repairing redirected bookmark {bookmark_id}: {e}")
            return None

    @transaction.atomic
    def update_bookmark_url(self, bookmark_id, new_url, user_id):
        """
        Update a bookmark's URL manually

        Args:
            bookmark_id: ID of the bookmark to update
            new_url: New URL to set
            user_id: ID of the user performing the action

        Returns:
            Updated bookmark or None if failed
        """
        try:
            bookmark = Bookmark.objects.get(id=bookmark_id)

            # Store original URL for history
            original_url = bookmark.url

            # Update bookmark URL
            bookmark.url = new_url
            bookmark.save()

            # Reset health status for rechecking
            try:
                health = bookmark.health
                health.status = 'pending'
                health.last_checked = None
                health.next_check = timezone.now()
                health.save()
            except LinkHealth.DoesNotExist:
                LinkHealth.objects.create(
                    bookmark=bookmark,
                    status='pending',
                    next_check=timezone.now()
                )

            # Log activity
            BookmarkActivity.objects.create(
                bookmark=bookmark,
                user_id=user_id,
                activity_type='updated',
                metadata={
                    'action': 'manual_url_update',
                    'original_url': original_url,
                    'new_url': new_url
                }
            )

            return bookmark
        except Exception as e:
            logger.error(f"Error updating bookmark {bookmark_id} URL: {e}")
            return None

def run_link_health_check(user_id=None, limit=BATCH_SIZE):
    """
    Convenience function to run a link health check batch

    Args:
        user_id: Optional user ID to check only their bookmarks
        limit: Maximum number of bookmarks to check

    Returns:
        List of LinkHealth records that were updated
    """
    checker = LinkHealthChecker()
    return checker.run_check_batch(user_id, limit)

def get_bookmark_health_summary(user_id=None):
    """
    Get a summary of bookmark health for a user or all users

    Args:
        user_id: Optional user ID to get summary for

    Returns:
        Dict with counts of healthy, redirected, broken, and pending bookmarks
    """
    query = LinkHealth.objects.all()

    if user_id:
        query = query.filter(bookmark__user_id=user_id)

    # Count bookmarks by status
    counts = {
        'ok': query.filter(status='ok').count(),
        'redirected': query.filter(status='redirected').count(),
        'broken': query.filter(status='broken').count(),
        'archived': query.filter(archive_url__isnull=False).exclude(archive_url='').count(),
        'pending': query.filter(status='pending').count(),
        'total_checked': query.count()
    }

    # Count bookmarks without health records
    unchecked_query = Bookmark.objects.filter(health__isnull=True)
    if user_id:
        unchecked_query = unchecked_query.filter(user_id=user_id)

    counts['unchecked'] = unchecked_query.count()
    counts['total'] = counts['total_checked'] + counts['unchecked']

    return counts
