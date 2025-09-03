from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db.models import Q
from bookmarks.models import Bookmark, LinkHealth, SavedView
from bookmarks.link_health import LinkHealthChecker
import logging
import time
from datetime import timedelta
from django.utils import timezone

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Checks bookmark links for health status and updates health records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=str,
            help='Username to check links for (default: all users)'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Maximum number of links to check (default: 100)'
        )
        parser.add_argument(
            '--priority',
            choices=['broken', 'redirected', 'all'],
            default='all',
            help='Priority of links to check (default: all)'
        )
        parser.add_argument(
            '--update-view',
            action='store_true',
            help='Update "Broken Links" smart view for each user'
        )

    def handle(self, *args, **options):
        start_time = time.time()
        self.stdout.write('Starting link health check...')

        # Get user if specified
        username = options.get('user')
        user_id = None
        if username:
            try:
                user = User.objects.get(username=username)
                user_id = user.id
                self.stdout.write(f'Checking links for user: {username}')
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'User {username} not found'))
                return

        # Get limit
        limit = options.get('limit')

        # Initialize checker
        checker = LinkHealthChecker()

        # Get bookmarks to check based on priority
        priority = options.get('priority')
        if priority == 'broken':
            # Check only broken links first
            bookmarks_to_check = self._get_broken_bookmarks(user_id, limit)
        elif priority == 'redirected':
            # Check redirected links first
            bookmarks_to_check = self._get_redirected_bookmarks(user_id, limit)
        else:
            # Default behavior - get bookmarks that need checking
            bookmarks_to_check = checker.get_bookmarks_for_checking(user_id, limit)

        # Check if we found any bookmarks to check
        if not bookmarks_to_check:
            self.stdout.write('No bookmarks need checking at this time')
            return

        # Process bookmarks
        self.stdout.write(f'Checking health for {len(bookmarks_to_check)} bookmarks...')
        results = checker.process_batch(bookmarks_to_check)

        # Count status results
        status_counts = {
            'ok': 0,
            'redirected': 0,
            'broken': 0,
            'archived': 0,
            'pending': 0,
            'errors': 0
        }

        for result in results:
            if result is None:
                status_counts['errors'] += 1
            else:
                if result.status in status_counts:
                    status_counts[result.status] += 1
                else:
                    status_counts['pending'] += 1

        # Print results
        self.stdout.write(self.style.SUCCESS(
            f"Link check complete! Results: "
            f"OK: {status_counts['ok']}, "
            f"Redirected: {status_counts['redirected']}, "
            f"Broken: {status_counts['broken']}, "
            f"Archive Available: {status_counts['archived']}, "
            f"Errors: {status_counts['errors']}"
        ))

        # Update smart views if requested
        if options.get('update_view'):
            if user_id:
                users = [User.objects.get(id=user_id)]
            else:
                # Get all users with bookmarks
                users = User.objects.filter(bookmarks__isnull=False).distinct()

            for user in users:
                self._update_broken_links_view(user)

        # Print execution time
        execution_time = time.time() - start_time
        self.stdout.write(f'Execution time: {execution_time:.2f} seconds')

    def _get_broken_bookmarks(self, user_id, limit):
        """Get bookmarks with broken status first"""
        query = Bookmark.objects.filter(health__status='broken')

        if user_id:
            query = query.filter(user_id=user_id)

        # Order by last checked (oldest first)
        query = query.order_by('health__last_checked')

        return list(query[:limit])

    def _get_redirected_bookmarks(self, user_id, limit):
        """Get bookmarks with redirected status first"""
        query = Bookmark.objects.filter(health__status='redirected')

        if user_id:
            query = query.filter(user_id=user_id)

        # Order by last checked (oldest first)
        query = query.order_by('health__last_checked')

        return list(query[:limit])

    def _update_broken_links_view(self, user):
        """Create or update the Broken Links smart view for a user"""
        # Get all broken bookmarks for this user
        broken_links = Bookmark.objects.filter(
            user=user,
            health__status__in=['broken']
        )

        # Convert to list of IDs
        broken_link_ids = [str(b.id) for b in broken_links]

        # Create filters for the saved view
        filters = {
            'broken_link_ids': broken_link_ids
        }

        try:
            # Check if view already exists
            view = SavedView.objects.get(
                user=user,
                name="Broken Links"
            )

            # Update the view
            view.description = f"Links that need attention ({len(broken_link_ids)} found)"
            view.filters = filters
            view.icon = "alert-triangle"
            view.is_system = True
            view.save()

            self.stdout.write(f'  Updated Broken Links view for {user.username}')
        except SavedView.DoesNotExist:
            # Create the view if it has broken links
            if broken_link_ids:
                SavedView.objects.create(
                    user=user,
                    name="Broken Links",
                    description=f"Links that need attention ({len(broken_link_ids)} found)",
                    filters=filters,
                    icon="alert-triangle",
                    is_system=True,
                    order=2  # Just below Duplicates view
                )
                self.stdout.write(f'  Created Broken Links view for {user.username}')
