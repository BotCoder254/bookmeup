from django.db import transaction
from django.db.models import Count, Q
from .models import Bookmark
from .utils import normalize_url, calculate_text_similarity
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class DuplicateManager:
    """Utility class for detecting and managing duplicate bookmarks"""

    def __init__(self):
        self.similarity_threshold = 0.8  # 80% similarity threshold for titles

    def detect_duplicates(self, user_id):
        """
        Detect duplicate bookmarks for a user

        Returns a list of duplicate groups:
        [
            {
                'normalized_url': 'https://example.com',
                'bookmarks': [bookmark1, bookmark2, ...]
            },
            ...
        ]
        """
        all_duplicates = []

        # Find duplicates by normalized URL first
        url_duplicates = self._detect_url_duplicates(user_id)
        all_duplicates.extend(url_duplicates)

        # Find duplicates by title similarity
        title_duplicates = self._detect_title_duplicates(user_id)

        # Filter out title duplicates that are already included in URL duplicates
        filtered_title_duplicates = []
        url_duplicate_ids = set()

        for url_group in url_duplicates:
            for bookmark in url_group['bookmarks']:
                url_duplicate_ids.add(bookmark.id)

        for title_group in title_duplicates:
            new_group = {'title_similarity': title_group['title_similarity'], 'bookmarks': []}
            for bookmark in title_group['bookmarks']:
                if bookmark.id not in url_duplicate_ids:
                    new_group['bookmarks'].append(bookmark)

            if len(new_group['bookmarks']) > 1:
                filtered_title_duplicates.append(new_group)

        all_duplicates.extend(filtered_title_duplicates)

        return all_duplicates

    def _detect_url_duplicates(self, user_id):
        """Detect duplicate bookmarks by normalized URL"""
        # First, we'll normalize all URLs
        bookmarks = Bookmark.objects.filter(user_id=user_id, is_archived=False)

        # Group bookmarks by normalized URL
        normalized_urls = {}

        # Also group by base URL without _dup parameter
        from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

        # Track original URLs to find duplicates created by the duplicate function
        base_url_mapping = {}

        for bookmark in bookmarks:
            normalized = normalize_url(bookmark.url)

            # Check if this URL has a _dup parameter
            parsed_url = urlparse(bookmark.url)
            query_params = parse_qs(parsed_url.query)

            # Extract base URL without _dup parameter
            is_duplicate = False
            if '_dup' in query_params:
                is_duplicate = True
                # Remove _dup param to get original URL
                clean_params = {k: v for k, v in query_params.items() if k != '_dup'}
                clean_url = urlunparse(
                    (
                        parsed_url.scheme,
                        parsed_url.netloc,
                        parsed_url.path,
                        parsed_url.params,
                        urlencode(clean_params, doseq=True),
                        parsed_url.fragment
                    )
                )
                clean_normalized = normalize_url(clean_url)

                # Track original to duplicate relationship
                if clean_normalized not in base_url_mapping:
                    base_url_mapping[clean_normalized] = []
                base_url_mapping[clean_normalized].append(bookmark)

            # Add to the standard normalized mapping
            if normalized not in normalized_urls:
                normalized_urls[normalized] = []
            normalized_urls[normalized].append(bookmark)

        # Add duplicates from the standard approach
        duplicates = [
            {'normalized_url': url, 'bookmarks': bookmarks, 'type': 'url_duplicate'}
            for url, bookmarks in normalized_urls.items()
            if len(bookmarks) > 1
        ]

        # Add duplicates from the _dup parameter approach
        for base_url, dup_bookmarks in base_url_mapping.items():
            # Find any bookmarks with this base URL
            original_bookmarks = []
            for bookmark in bookmarks:
                norm_url = normalize_url(bookmark.url)
                if norm_url == base_url:
                    original_bookmarks.append(bookmark)

            # If we found originals, combine with duplicates
            if original_bookmarks:
                all_related = original_bookmarks + dup_bookmarks
                if len(all_related) > 1 and not any(
                    set(all_related).issubset(set(group['bookmarks']))
                    for group in duplicates
                ):
                    duplicates.append({
                        'normalized_url': base_url,
                        'bookmarks': all_related,
                        'type': 'url_duplicate'
                    })

        return duplicates

    def _detect_title_duplicates(self, user_id):
        """Detect duplicate bookmarks by title similarity"""
        # Get bookmarks with non-empty titles
        bookmarks = Bookmark.objects.filter(
            user_id=user_id,
            is_archived=False
        ).exclude(title='')

        # Use a more efficient approach for large collections
        if len(bookmarks) > 1000:
            return self._detect_title_duplicates_efficient(bookmarks)

        # For smaller collections, we can do a more thorough comparison
        bookmark_list = list(bookmarks)
        duplicate_groups = []
        processed_ids = set()

        for i, bookmark1 in enumerate(bookmark_list):
            if bookmark1.id in processed_ids:
                continue

            group = {'title_similarity': True, 'bookmarks': [bookmark1]}
            processed_ids.add(bookmark1.id)

            for j in range(i + 1, len(bookmark_list)):
                bookmark2 = bookmark_list[j]
                if bookmark2.id in processed_ids:
                    continue

                similarity = calculate_text_similarity(bookmark1.title, bookmark2.title)
                if similarity >= self.similarity_threshold:
                    group['bookmarks'].append(bookmark2)
                    processed_ids.add(bookmark2.id)

            if len(group['bookmarks']) > 1:
                duplicate_groups.append(group)

        return duplicate_groups

    def _detect_title_duplicates_efficient(self, bookmarks):
        """
        More efficient title duplicate detection for large bookmark collections
        Uses word trigrams as an initial filter before doing full similarity calculation
        """
        from collections import defaultdict

        # Generate title trigrams for each bookmark
        trigram_index = defaultdict(list)

        for bookmark in bookmarks:
            title = bookmark.title.lower()
            for i in range(len(title) - 2):
                trigram = title[i:i+3]
                trigram_index[trigram].append(bookmark)

        # Find candidate pairs
        candidate_pairs = set()
        for trigram, bookmark_list in trigram_index.items():
            if len(bookmark_list) > 1:
                for i, b1 in enumerate(bookmark_list):
                    for b2 in bookmark_list[i+1:]:
                        if b1.id != b2.id:
                            pair = (min(b1.id, b2.id), max(b1.id, b2.id))
                            candidate_pairs.add(pair)

        # Calculate full similarity for candidate pairs
        bookmark_dict = {b.id: b for b in bookmarks}
        similarity_groups = defaultdict(list)

        for b1_id, b2_id in candidate_pairs:
            b1 = bookmark_dict[b1_id]
            b2 = bookmark_dict[b2_id]
            similarity = calculate_text_similarity(b1.title, b2.title)

            if similarity >= self.similarity_threshold:
                group_id = b1_id  # Use first bookmark ID as group ID
                similarity_groups[group_id].append(b1)
                similarity_groups[group_id].append(b2)

        # Convert to list of duplicate groups
        duplicate_groups = []
        for group_id, group_bookmarks in similarity_groups.items():
            # Remove duplicates from the list
            unique_bookmarks = []
            seen_ids = set()

            for b in group_bookmarks:
                if b.id not in seen_ids:
                    unique_bookmarks.append(b)
                    seen_ids.add(b.id)

            if len(unique_bookmarks) > 1:
                duplicate_groups.append({
                    'title_similarity': True,
                    'bookmarks': unique_bookmarks
                })

        return duplicate_groups

    @transaction.atomic
    def merge_bookmarks(self, primary_id, duplicate_ids):
        """
        Merge duplicate bookmarks into a primary bookmark

        Args:
            primary_id (str): ID of the primary bookmark to keep
            duplicate_ids (list): List of IDs of duplicate bookmarks to merge

        Returns:
            The updated primary bookmark
        """
        try:
            if not primary_id or not duplicate_ids:
                logger.error("Missing required parameters: primary_id or duplicate_ids")
                raise ValueError("Both primary_id and duplicate_ids are required")

            # Convert all IDs to strings for consistent comparison
            primary_id_str = str(primary_id)
            duplicate_ids = [str(d_id) for d_id in duplicate_ids]

            # Filter out primary_id from duplicate_ids to prevent merging a bookmark with itself
            duplicate_ids = [d_id for d_id in duplicate_ids if d_id != primary_id_str]

            if not duplicate_ids:
                logger.warning(f"No valid duplicates to merge with primary bookmark {primary_id_str}")
                raise ValueError("Cannot merge a bookmark with itself")

            # Get all bookmarks
            primary = Bookmark.objects.get(id=primary_id)

            # Log query details
            logger.info(f"Fetching duplicates with IDs: {duplicate_ids}")
            duplicates = Bookmark.objects.filter(id__in=duplicate_ids)
            logger.info(f"Found {duplicates.count()} duplicates")

            if not duplicates.exists():
                logger.error(f"No duplicates found with IDs: {duplicate_ids}")
                raise ValueError("No duplicate bookmarks found to merge")

            # Verify all bookmarks belong to the same user
            if duplicates.exists():
                first_user_id = primary.user_id
                for dup in duplicates:
                    if dup.user_id != first_user_id:
                        raise ValueError("Cannot merge bookmarks from different users")

            # Combine tags
            existing_tag_ids = set(primary.tags.values_list('id', flat=True))
            for duplicate in duplicates:
                for tag in duplicate.tags.all():
                    if tag.id not in existing_tag_ids:
                        primary.tags.add(tag)
                        existing_tag_ids.add(tag.id)

            # Combine notes if present
            if not primary.notes:
                # Find the first duplicate with notes
                for duplicate in duplicates:
                    if duplicate.notes:
                        primary.notes = duplicate.notes
                        break

            # Combine bookmark_notes
            for duplicate in duplicates:
                for note in duplicate.bookmark_notes.filter(is_active=True):
                    # Check if this is a newer active note
                    primary_note = primary.bookmark_notes.filter(is_active=True).first()
                    if not primary_note or note.updated_at > primary_note.updated_at:
                        if primary_note:
                            # Make the current primary note inactive
                            primary_note.is_active = False
                            primary_note.save()

                        # Create a new note for the primary bookmark
                        from .models import BookmarkNote
                        BookmarkNote.objects.create(
                            bookmark=primary,
                            user=note.user,
                            content=note.content,
                            plain_text=note.plain_text,
                            is_active=True
                        )

            # Keep the earliest created date
            for duplicate in duplicates:
                if duplicate.created_at < primary.created_at:
                    primary.created_at = duplicate.created_at

            # If primary doesn't have a title/description but a duplicate does, use that
            for duplicate in duplicates:
                if not primary.title and duplicate.title:
                    primary.title = duplicate.title
                if not primary.description and duplicate.description:
                    primary.description = duplicate.description
                if not primary.favicon_url and duplicate.favicon_url:
                    primary.favicon_url = duplicate.favicon_url
                if not primary.screenshot_url and duplicate.screenshot_url:
                    primary.screenshot_url = duplicate.screenshot_url

            # If primary is not favorited but any duplicate is, make it a favorite
            if not primary.is_favorite:
                for duplicate in duplicates:
                    if duplicate.is_favorite:
                        primary.is_favorite = True
                        break

            # Mark primary as read if any duplicate is read
            if not primary.is_read:
                for duplicate in duplicates:
                    if duplicate.is_read:
                        primary.is_read = True
                        break

            # Save changes to primary bookmark
            primary.save()

            # Log the merge activity
            from .models import BookmarkActivity

            # Create a list to store duplicate info for error handling
            duplicate_info = []

            logger.info(f"Processing {duplicates.count()} duplicates for merge into {primary.id}")

            for duplicate in duplicates:
                try:
                    # Store duplicate info before deletion
                    duplicate_info.append({
                        'id': str(duplicate.id),
                        'url': duplicate.url,
                        'title': duplicate.title
                    })

                    # Create activity record
                    BookmarkActivity.objects.create(
                        bookmark=primary,
                        user=primary.user,
                        activity_type='merged',
                        metadata={
                            'merged_from': str(duplicate.id),
                            'merged_url': duplicate.url,
                            'merged_title': duplicate.title
                        }
                    )

                    # Delete the duplicate bookmark
                    duplicate.delete()
                except Exception as e:
                    logger.error(f"Error processing duplicate {duplicate.id}: {str(e)}")
                    # Continue with other duplicates even if one fails

            if not duplicate_info:
                logger.warning(f"No duplicates were processed during merge for primary={primary_id}")

            # Refresh from database to get latest state
            primary.refresh_from_db()
            return primary

        except Bookmark.DoesNotExist:
            logger.error(f"Bookmark not found during merge: primary={primary_id}, duplicates={duplicate_ids}")
            raise ValueError("One or more bookmarks not found")
        except ValueError as e:
            # Re-raise ValueError exceptions with the original message
            logger.error(f"Validation error during merge: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error merging bookmarks: {str(e)}", exc_info=True)
            # Provide a more specific error message if possible
            if "duplicate key" in str(e).lower():
                raise ValueError("Conflict with existing bookmark data. Please try again.")
            elif "IntegrityError" in str(e):
                raise ValueError("Database integrity error. Please try again.")
            else:
                raise ValueError(f"Error merging bookmarks: {str(e)}")
