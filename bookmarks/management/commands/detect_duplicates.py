from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from bookmarks.duplicates import DuplicateManager
from bookmarks.models import SavedView, Bookmark
import json
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Detects duplicate bookmarks and updates the Duplicates smart view for each user'

    def handle(self, *args, **options):
        self.stdout.write('Starting duplicate bookmark detection...')

        # Get all users with bookmarks
        users_with_bookmarks = User.objects.filter(bookmarks__isnull=False).distinct()

        duplicate_manager = DuplicateManager()
        total_duplicates = 0

        for user in users_with_bookmarks:
            self.stdout.write(f'Processing user: {user.username}')

            # Detect duplicates for this user
            duplicate_groups = duplicate_manager.detect_duplicates(user.id)

            if duplicate_groups:
                duplicate_count = sum(len(group['bookmarks']) for group in duplicate_groups)
                total_duplicates += duplicate_count

                # Generate a list of bookmark IDs that are duplicates
                duplicate_ids = []
                for group in duplicate_groups:
                    for bookmark in group['bookmarks']:
                        duplicate_ids.append(str(bookmark.id))

                # Create or update the "Duplicates" smart view for this user
                self._update_duplicates_view(user, duplicate_ids)

                self.stdout.write(f'  Found {duplicate_count} bookmarks in {len(duplicate_groups)} duplicate groups')
            else:
                self.stdout.write(f'  No duplicates found for {user.username}')
                # If no duplicates, make sure to clear any existing duplicates view
                self._update_duplicates_view(user, [])

        self.stdout.write(f'Duplicate detection complete. Found {total_duplicates} total duplicate bookmarks.')

    def _update_duplicates_view(self, user, duplicate_ids):
        """Create or update the Duplicates smart view for a user"""
        # Define the filters for the smart view
        filters = {}

        if duplicate_ids:
            filters['duplicate_ids'] = duplicate_ids

        # Check if the user already has a Duplicates smart view
        try:
            duplicates_view = SavedView.objects.get(
                user=user,
                name="Duplicates"
            )

            # Update the existing view
            duplicates_view.filters = filters
            duplicates_view.description = f"Bookmarks with duplicate URLs or similar titles ({len(duplicate_ids)} found)"
            duplicates_view.icon = "lightning"
            duplicates_view.save()

            self.stdout.write(f'  Updated existing Duplicates smart view for {user.username}')
        except SavedView.DoesNotExist:
            # Create a new view
            if duplicate_ids:
                SavedView.objects.create(
                    user=user,
                    name="Duplicates",
                    description=f"Bookmarks with duplicate URLs or similar titles ({len(duplicate_ids)} found)",
                    filters=filters,
                    icon="lightning",
                    order=1  # High priority in the sidebar
                )
                self.stdout.write(f'  Created new Duplicates smart view for {user.username}')
