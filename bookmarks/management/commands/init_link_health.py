from django.core.management.base import BaseCommand
from bookmarks.models import Bookmark, LinkHealth
from django.db import transaction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Initialize LinkHealth records for all bookmarks that do not have one'

    def handle(self, *args, **options):
        self.stdout.write('Starting link health initialization...')

        # Get all bookmarks without a link health record
        bookmarks_without_health = []
        total_bookmarks = Bookmark.objects.count()

        # We need to check each bookmark individually since we're using a OneToOneField
        for bookmark in Bookmark.objects.all():
            try:
                # Try to access the health relation
                health = bookmark.health
            except LinkHealth.DoesNotExist:
                bookmarks_without_health.append(bookmark)

        self.stdout.write(f'Found {len(bookmarks_without_health)} bookmarks without link health records out of {total_bookmarks} total bookmarks.')

        # Create LinkHealth records for bookmarks that don't have one
        link_health_objects = []
        now = timezone.now()

        with transaction.atomic():
            for bookmark in bookmarks_without_health:
                link_health = LinkHealth(
                    bookmark=bookmark,
                    status='pending',
                    last_checked=None,
                    next_check=now,  # Schedule an immediate check
                    check_count=0
                )
                link_health_objects.append(link_health)

            # Bulk create all link health objects
            if link_health_objects:
                LinkHealth.objects.bulk_create(link_health_objects)
                self.stdout.write(self.style.SUCCESS(f'Successfully created {len(link_health_objects)} link health records'))
            else:
                self.stdout.write('No link health records needed to be created')

        self.stdout.write(self.style.SUCCESS('Link health initialization completed successfully'))
