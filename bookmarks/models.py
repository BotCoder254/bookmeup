from django.db import models
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils.text import slugify
from django.db.models import Q
import uuid
import json


class Tag(models.Model):
    """Tags for organizing bookmarks"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True, blank=True)
    color = models.CharField(max_length=7, default='#6366f1')  # Hex color
    order = models.PositiveIntegerField(default=0)  # Custom ordering
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tags')

    class Meta:
        ordering = ['order', 'name']
        unique_together = ['user', 'name']
        indexes = [
            models.Index(fields=['user', 'order']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    @property
    def bookmark_count(self):
        """Cached bookmark count for this tag"""
        return self.bookmarks.filter(user=self.user).count()


class Collection(models.Model):
    """Collections for grouping bookmarks"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    slug = models.SlugField(max_length=100, blank=True)
    is_public = models.BooleanField(default=False)
    cover_image = models.URLField(blank=True, null=True)  # User-set or auto-picked cover
    order = models.PositiveIntegerField(default=0)  # Custom ordering
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='collections')

    class Meta:
        ordering = ['order', '-created_at']
        unique_together = ['user', 'name']
        indexes = [
            models.Index(fields=['user', 'order']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    @property
    def bookmark_count(self):
        return self.bookmarks.count()

    def get_cover_image(self):
        """Get cover image (user-set or auto-picked from bookmarks)"""
        if self.cover_image:
            return self.cover_image

        # Auto-pick from top bookmarks with images
        bookmark_with_image = self.bookmarks.filter(
            screenshot_url__isnull=False
        ).exclude(screenshot_url='').first()

        if bookmark_with_image:
            return bookmark_with_image.screenshot_url

        return None


class Bookmark(models.Model):
    """Main bookmark model"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    url = models.URLField(max_length=2000)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)  # Legacy field, use bookmark_notes relationship instead
    content = models.TextField(blank=True)  # Extracted page content for search
    favicon_url = models.URLField(blank=True, null=True)
    screenshot_url = models.URLField(blank=True, null=True)

    # Metadata
    is_favorite = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    is_public = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)  # Read status

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    visited_at = models.DateTimeField(null=True, blank=True)

    # Relationships
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmarks')
    tags = models.ManyToManyField(Tag, blank=True, related_name='bookmarks')
    collection = models.ForeignKey(
        Collection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookmarks'
    )

    # Search and organization
    domain = models.CharField(max_length=255, blank=True)  # extracted from URL

    class Meta:
        ordering = ['-created_at']
        unique_together = ['user', 'url']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['user', 'is_favorite']),
            models.Index(fields=['user', 'is_archived']),
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['domain']),
            models.Index(fields=['title']),
            models.Index(fields=['user', 'domain']),
        ]

    def save(self, *args, **kwargs):
        # Extract domain from URL
        if self.url:
            from urllib.parse import urlparse
            parsed_url = urlparse(self.url)
            self.domain = parsed_url.netloc.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title or self.url

    def get_absolute_url(self):
        return reverse('bookmark-detail', kwargs={'pk': self.pk})

    @property
    def tag_names(self):
        return [tag.name for tag in self.tags.all()]


class BookmarkActivity(models.Model):
    """Track bookmark activities for analytics"""
    ACTIVITY_TYPES = [
        ('created', 'Created'),
        ('updated', 'Updated'),
        ('visited', 'Visited'),
        ('favorited', 'Favorited'),
        ('unfavorited', 'Unfavorited'),
        ('archived', 'Archived'),
        ('unarchived', 'Unarchived'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bookmark = models.ForeignKey(Bookmark, on_delete=models.CASCADE, related_name='activities')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)  # Additional activity data

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['bookmark', 'activity_type']),
        ]

    def __str__(self):
        return f'{self.user.username} {self.activity_type} {self.bookmark.title}'


class SavedView(models.Model):
    """Saved search filters and views for users"""
    ICON_CHOICES = [
        ('bookmark', 'Bookmark'),
        ('search', 'Search'),
        ('filter', 'Filter'),
        ('star', 'Star'),
        ('heart', 'Heart'),
        ('folder', 'Folder'),
        ('tag', 'Tag'),
        ('clock', 'Clock'),
        ('eye', 'Eye'),
        ('lightning', 'Lightning'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=20, choices=ICON_CHOICES, default='search')
    description = models.TextField(blank=True)
    filters = models.JSONField(default=dict)  # Stored filter configuration
    is_public = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)  # For custom ordering in sidebar

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used = models.DateTimeField(null=True, blank=True)

    # Relationships
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_views')

    class Meta:
        ordering = ['order', '-last_used']
        unique_together = ['user', 'name']
        indexes = [
            models.Index(fields=['user', 'order']),
            models.Index(fields=['user', 'last_used']),
        ]

    def __str__(self):
        return f'{self.name} - {self.user.username}'

    def get_filter_summary(self):
        """Generate a human-readable summary of the filters"""
        if not self.filters:
            return "All bookmarks"

        parts = []
        if self.filters.get('search'):
            parts.append(f"Text: '{self.filters['search']}'")
        if self.filters.get('tags'):
            parts.append(f"Tags: {', '.join(self.filters['tags'])}")
        if self.filters.get('domain'):
            parts.append(f"Domain: {self.filters['domain']}")
        if self.filters.get('collection'):
            parts.append(f"Collection: {self.filters['collection']}")
        if self.filters.get('is_favorite'):
            parts.append("Favorites only")
        if self.filters.get('is_read') is False:
            parts.append("Unread only")
        if self.filters.get('date_from') or self.filters.get('date_to'):
            date_range = []
            if self.filters.get('date_from'):
                date_range.append(f"from {self.filters['date_from']}")
            if self.filters.get('date_to'):
                date_range.append(f"to {self.filters['date_to']}")
            parts.append(f"Date: {' '.join(date_range)}")

        return " | ".join(parts) if parts else "All bookmarks"


class BookmarkNote(models.Model):
    """Notes for bookmarks with history"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bookmark = models.ForeignKey(Bookmark, on_delete=models.CASCADE, related_name='bookmark_notes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmark_notes')
    content = models.TextField()  # Sanitized HTML content
    plain_text = models.TextField()  # Plain text version for search
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)  # For keeping edit history
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='revisions')

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['bookmark', 'is_active']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f"Note for {self.bookmark.title} ({self.created_at.strftime('%Y-%m-%d')})"

    @property
    def has_revisions(self):
        return self.revisions.exists()

    def create_revision(self):
        """Create a new revision based on the current state"""
        if self.is_active:
            # Deactivate current note
            revision = BookmarkNote.objects.create(
                bookmark=self.bookmark,
                user=self.user,
                content=self.content,
                plain_text=self.plain_text,
                is_active=False,
                parent=self
            )
            return revision
        return None


class BookmarkSnapshot(models.Model):
    """Readable snapshot of bookmarked pages"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bookmark = models.ForeignKey(Bookmark, on_delete=models.CASCADE, related_name='snapshots')
    html_content = models.TextField()  # Sanitized HTML content
    plain_text = models.TextField()  # Plain text version for search
    screenshot_url = models.URLField(blank=True, null=True)  # Optional screenshot
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ], default='pending')
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['bookmark', 'created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Snapshot of {self.bookmark.title} ({self.created_at.strftime('%Y-%m-%d')})"


class BookmarkHighlight(models.Model):
    """Highlighted text within a bookmark"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bookmark = models.ForeignKey(Bookmark, on_delete=models.CASCADE, related_name='highlights')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmark_highlights')
    text = models.TextField()  # The highlighted text
    note = models.TextField(blank=True)  # Optional note about the highlight
    color = models.CharField(max_length=7, default='#FFFF00')  # Highlight color
    position_data = models.JSONField(default=dict)  # Position information in the document
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['bookmark', 'created_at']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f"Highlight: {self.text[:50]}{'...' if len(self.text) > 50 else ''}"
