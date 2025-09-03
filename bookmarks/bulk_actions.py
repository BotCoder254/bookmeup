"""
Bulk actions implementation for bookmarks
Supports batch operations like tagging, moving to collections, archiving, etc.
"""

import logging
import json
from django.db import transaction
from django.utils import timezone
from concurrent.futures import ThreadPoolExecutor
from .models import Bookmark, Tag, Collection, BulkActionJob, BookmarkActivity, LinkHealth

logger = logging.getLogger(__name__)

class BulkActionProcessor:
    """Process bulk actions on bookmarks"""

    def __init__(self, job_id=None, max_workers=5):
        self.job_id = job_id
        self.max_workers = max_workers
        self.job = None

    def get_job(self):
        """Load the job from database"""
        if not self.job and self.job_id:
            try:
                self.job = BulkActionJob.objects.get(id=self.job_id)
                return self.job
            except BulkActionJob.DoesNotExist:
                logger.error(f"Bulk action job {self.job_id} not found")
                return None
        return self.job

    def start_job(self):
        """Start processing a job"""
        job = self.get_job()
        if not job:
            logger.error("No job to process")
            return False

        if job.status != 'pending':
            logger.warning(f"Job {job.id} is not pending (status: {job.status})")
            return False

        # Update job status
        job.status = 'processing'
        job.save(update_fields=['status', 'updated_at'])

        # Process based on action type
        try:
            action_type = job.action_type

            # Get bookmarks
            bookmark_ids = job.bookmark_ids
            job.total_items = len(bookmark_ids)
            job.save(update_fields=['total_items'])

            # Dispatch to appropriate handler
            if action_type == 'tag':
                result = self._process_add_tags(job, bookmark_ids)
            elif action_type == 'untag':
                result = self._process_remove_tags(job, bookmark_ids)
            elif action_type == 'move':
                result = self._process_move_to_collection(job, bookmark_ids)
            elif action_type == 'archive':
                result = self._process_archive(job, bookmark_ids, archive=True)
            elif action_type == 'unarchive':
                result = self._process_archive(job, bookmark_ids, archive=False)
            elif action_type == 'favorite':
                result = self._process_favorite(job, bookmark_ids, favorite=True)
            elif action_type == 'unfavorite':
                result = self._process_favorite(job, bookmark_ids, favorite=False)
            elif action_type == 'delete':
                result = self._process_delete(job, bookmark_ids)
            elif action_type == 'mark_read':
                result = self._process_mark_read(job, bookmark_ids, read=True)
            elif action_type == 'mark_unread':
                result = self._process_mark_read(job, bookmark_ids, read=False)
            elif action_type == 'check_health':
                result = self._process_check_health(job, bookmark_ids)
            elif action_type == 'export':
                result = self._process_export(job, bookmark_ids)
            elif action_type == 'merge':
                result = self._process_merge(job, bookmark_ids)
            else:
                logger.error(f"Unknown action type: {action_type}")
                job.status = 'failed'
                job.error_message = f"Unknown action type: {action_type}"
                job.save(update_fields=['status', 'error_message', 'updated_at'])
                return False

            # Update job with results
            if result.get('success', False):
                job.status = 'completed'
                job.result_data = result
                job.completed_at = timezone.now()
            else:
                job.status = 'failed'
                job.error_message = result.get('error', 'Unknown error')
                job.result_data = result

            job.processed_items = result.get('processed_count', 0)
            job.save()
            return True

        except Exception as e:
            logger.exception(f"Error processing bulk action job {job.id}: {e}")
            job.status = 'failed'
            job.error_message = str(e)
            job.save(update_fields=['status', 'error_message', 'updated_at'])
            return False

    @transaction.atomic
    def _process_add_tags(self, job, bookmark_ids):
        """Add tags to bookmarks"""
        tag_ids = job.parameters.get('tag_ids', [])
        if not tag_ids:
            return {
                'success': False,
                'error': 'No tags specified',
                'processed_count': 0
            }

        # Verify tags belong to the user
        tags = Tag.objects.filter(id__in=tag_ids, user=job.user)
        if len(tags) != len(tag_ids):
            return {
                'success': False,
                'error': 'One or more tags not found',
                'processed_count': 0
            }

        # Get bookmarks
        bookmarks = Bookmark.objects.filter(id__in=bookmark_ids, user=job.user)
        processed_count = 0

        # Add tags to each bookmark
        for bookmark in bookmarks:
            for tag in tags:
                bookmark.tags.add(tag)

            # Log activity
            BookmarkActivity.objects.create(
                bookmark=bookmark,
                user=job.user,
                activity_type='updated',
                metadata={
                    'bulk_action': 'add_tags',
                    'tags_added': [str(t.id) for t in tags],
                    'bulk_job_id': str(job.id)
                }
            )

            processed_count += 1
            job.processed_items = processed_count
            job.save(update_fields=['processed_items'])

        return {
            'success': True,
            'processed_count': processed_count,
            'tags': [{'id': str(t.id), 'name': t.name} for t in tags]
        }

    @transaction.atomic
    def _process_remove_tags(self, job, bookmark_ids):
        """Remove tags from bookmarks"""
        tag_ids = job.parameters.get('tag_ids', [])
        if not tag_ids:
            return {
                'success': False,
                'error': 'No tags specified',
                'processed_count': 0
            }

        # Verify tags belong to the user
        tags = Tag.objects.filter(id__in=tag_ids, user=job.user)

        # Get bookmarks
        bookmarks = Bookmark.objects.filter(id__in=bookmark_ids, user=job.user)
        processed_count = 0

        # Remove tags from each bookmark
        for bookmark in bookmarks:
            for tag in tags:
                bookmark.tags.remove(tag)

            # Log activity
            BookmarkActivity.objects.create(
                bookmark=bookmark,
                user=job.user,
                activity_type='updated',
                metadata={
                    'bulk_action': 'remove_tags',
                    'tags_removed': [str(t.id) for t in tags],
                    'bulk_job_id': str(job.id)
                }
            )

            processed_count += 1
            job.processed_items = processed_count
            job.save(update_fields=['processed_items'])

        return {
            'success': True,
            'processed_count': processed_count,
            'tags': [{'id': str(t.id), 'name': t.name} for t in tags]
        }

    @transaction.atomic
    def _process_move_to_collection(self, job, bookmark_ids):
        """Move bookmarks to a collection"""
        collection_id = job.parameters.get('collection_id')

        # Check for "no collection" case
        if collection_id == 'none':
            collection = None
        else:
            # Verify collection belongs to the user
            try:
                collection = Collection.objects.get(id=collection_id, user=job.user)
            except Collection.DoesNotExist:
                return {
                    'success': False,
                    'error': 'Collection not found',
                    'processed_count': 0
                }

        # Get bookmarks
        bookmarks = Bookmark.objects.filter(id__in=bookmark_ids, user=job.user)
        processed_count = 0

        # Move each bookmark to the collection
        for bookmark in bookmarks:
            bookmark.collection = collection
            bookmark.save(update_fields=['collection'])

            # Log activity
            BookmarkActivity.objects.create(
                bookmark=bookmark,
                user=job.user,
                activity_type='updated',
                metadata={
                    'bulk_action': 'move_to_collection',
                    'collection_id': str(collection.id) if collection else None,
                    'bulk_job_id': str(job.id)
                }
            )

            processed_count += 1
            job.processed_items = processed_count
            job.save(update_fields=['processed_items'])

        return {
            'success': True,
            'processed_count': processed_count,
            'collection': {
                'id': str(collection.id) if collection else None,
                'name': collection.name if collection else 'None'
            }
        }

    @transaction.atomic
    def _process_archive(self, job, bookmark_ids, archive=True):
        """Archive or unarchive bookmarks"""
        # Get bookmarks
        bookmarks = Bookmark.objects.filter(id__in=bookmark_ids, user=job.user)
        processed_count = 0

        # Archive/unarchive each bookmark
        for bookmark in bookmarks:
            bookmark.is_archived = archive
            bookmark.save(update_fields=['is_archived'])

            # Log activity
            activity_type = 'archived' if archive else 'unarchived'
            BookmarkActivity.objects.create(
                bookmark=bookmark,
                user=job.user,
                activity_type=activity_type,
                metadata={
                    'bulk_action': 'archive' if archive else 'unarchive',
                    'bulk_job_id': str(job.id)
                }
            )

            processed_count += 1
            job.processed_items = processed_count
            job.save(update_fields=['processed_items'])

        return {
            'success': True,
            'processed_count': processed_count,
            'archived': archive
        }

    @transaction.atomic
    def _process_favorite(self, job, bookmark_ids, favorite=True):
        """Favorite or unfavorite bookmarks"""
        # Get bookmarks
        bookmarks = Bookmark.objects.filter(id__in=bookmark_ids, user=job.user)
        processed_count = 0

        # Favorite/unfavorite each bookmark
        for bookmark in bookmarks:
            bookmark.is_favorite = favorite
            bookmark.save(update_fields=['is_favorite'])

            # Log activity
            activity_type = 'favorited' if favorite else 'unfavorited'
            BookmarkActivity.objects.create(
                bookmark=bookmark,
                user=job.user,
                activity_type=activity_type,
                metadata={
                    'bulk_action': 'favorite' if favorite else 'unfavorite',
                    'bulk_job_id': str(job.id)
                }
            )

            processed_count += 1
            job.processed_items = processed_count
            job.save(update_fields=['processed_items'])

        return {
            'success': True,
            'processed_count': processed_count,
            'favorited': favorite
        }

    @transaction.atomic
    def _process_mark_read(self, job, bookmark_ids, read=True):
        """Mark bookmarks as read or unread"""
        # Get bookmarks
        bookmarks = Bookmark.objects.filter(id__in=bookmark_ids, user=job.user)
        processed_count = 0

        # Mark each bookmark
        for bookmark in bookmarks:
            bookmark.is_read = read
            if read and not bookmark.visited_at:
                bookmark.visited_at = timezone.now()
            bookmark.save(update_fields=['is_read', 'visited_at'] if read else ['is_read'])

            # Log activity
            BookmarkActivity.objects.create(
                bookmark=bookmark,
                user=job.user,
                activity_type='visited' if read else 'updated',
                metadata={
                    'bulk_action': 'mark_read' if read else 'mark_unread',
                    'bulk_job_id': str(job.id)
                }
            )

            processed_count += 1
            job.processed_items = processed_count
            job.save(update_fields=['processed_items'])

        return {
            'success': True,
            'processed_count': processed_count,
            'marked_read': read
        }

    @transaction.atomic
    def _process_delete(self, job, bookmark_ids):
        """Delete bookmarks"""
        # Get bookmarks
        bookmarks = Bookmark.objects.filter(id__in=bookmark_ids, user=job.user)
        processed_count = 0
        deleted_info = []

        # Delete each bookmark
        for bookmark in bookmarks:
            # Store info for record
            deleted_info.append({
                'id': str(bookmark.id),
                'title': bookmark.title,
                'url': bookmark.url
            })

            # Delete the bookmark
            bookmark.delete()

            processed_count += 1
            job.processed_items = processed_count
            job.save(update_fields=['processed_items'])

        return {
            'success': True,
            'processed_count': processed_count,
            'deleted_bookmarks': deleted_info
        }

    def _process_check_health(self, job, bookmark_ids):
        """Check health of bookmark links"""
        from .link_health import LinkHealthChecker

        # Get bookmarks
        bookmarks = list(Bookmark.objects.filter(id__in=bookmark_ids, user=job.user))
        processed_count = 0

        # Initialize checker
        checker = LinkHealthChecker()

        # Process in batches to avoid overwhelming the system
        batch_size = 10
        results_by_status = {
            'ok': 0,
            'redirected': 0,
            'broken': 0,
            'archived': 0,
            'pending': 0,
            'error': 0
        }

        for i in range(0, len(bookmarks), batch_size):
            batch = bookmarks[i:i+batch_size]
            batch_results = checker.process_batch(batch)

            for result in batch_results:
                if result is None:
                    results_by_status['error'] += 1
                else:
                    if result.status in results_by_status:
                        results_by_status[result.status] += 1
                    else:
                        results_by_status['pending'] += 1

            processed_count += len(batch)
            job.processed_items = processed_count
            job.save(update_fields=['processed_items'])

        return {
            'success': True,
            'processed_count': processed_count,
            'status_counts': results_by_status
        }

    def _process_export(self, job, bookmark_ids):
        """Export bookmarks to various formats"""
        export_format = job.parameters.get('format', 'json')
        include_tags = job.parameters.get('include_tags', True)
        include_notes = job.parameters.get('include_notes', True)

        # Get bookmarks with prefetched tags
        bookmarks = Bookmark.objects.filter(
            id__in=bookmark_ids,
            user=job.user
        ).prefetch_related('tags')

        processed_count = 0
        exported_data = []

        # Process bookmarks
        for bookmark in bookmarks:
            bookmark_data = {
                'id': str(bookmark.id),
                'title': bookmark.title,
                'url': bookmark.url,
                'description': bookmark.description,
                'domain': bookmark.domain,
                'created_at': bookmark.created_at.isoformat() if bookmark.created_at else None,
                'is_favorite': bookmark.is_favorite,
                'is_archived': bookmark.is_archived,
                'is_read': bookmark.is_read
            }

            if include_tags:
                bookmark_data['tags'] = [tag.name for tag in bookmark.tags.all()]

            if include_notes:
                bookmark_data['notes'] = bookmark.notes

            exported_data.append(bookmark_data)
            processed_count += 1
            job.processed_items = processed_count
            job.save(update_fields=['processed_items'])

        # Generate export based on format
        export_result = {
            'json': json.dumps(exported_data, indent=2),
            'count': len(exported_data),
            'format': export_format
        }

        # For HTML and CSV formats, we'd add more conversion here
        if export_format == 'html':
            html_content = self._generate_html_export(exported_data)
            export_result['html'] = html_content
        elif export_format == 'csv':
            csv_content = self._generate_csv_export(exported_data)
            export_result['csv'] = csv_content

        return {
            'success': True,
            'processed_count': processed_count,
            'export_result': export_result
        }

    def _generate_html_export(self, bookmarks):
        """Generate HTML export of bookmarks"""
        html = ['<!DOCTYPE html>',
                '<html>',
                '<head>',
                '    <meta charset="UTF-8">',
                '    <title>BookMeUp - Exported Bookmarks</title>',
                '    <style>',
                '        body { font-family: Arial, sans-serif; margin: 20px; }',
                '        .bookmark { margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }',
                '        .title { font-size: 18px; font-weight: bold; }',
                '        .url { color: #0066cc; }',
                '        .description { margin-top: 5px; color: #555; }',
                '        .meta { margin-top: 5px; font-size: 12px; color: #777; }',
                '        .tags { margin-top: 5px; }',
                '        .tag { background: #eee; padding: 2px 5px; border-radius: 3px; font-size: 12px; margin-right: 5px; }',
                '    </style>',
                '</head>',
                '<body>',
                '    <h1>Exported Bookmarks</h1>',
                '    <p>Exported on ' + timezone.now().strftime('%Y-%m-%d %H:%M:%S') + '</p>',
                '    <div class="bookmarks">']

        for bookmark in bookmarks:
            html.append('        <div class="bookmark">')
            html.append(f'            <div class="title">{bookmark["title"]}</div>')
            html.append(f'            <a href="{bookmark["url"]}" class="url">{bookmark["url"]}</a>')
            if bookmark.get('description'):
                html.append(f'            <div class="description">{bookmark["description"]}</div>')

            # Tags
            if 'tags' in bookmark and bookmark['tags']:
                html.append('            <div class="tags">')
                for tag in bookmark['tags']:
                    html.append(f'                <span class="tag">{tag}</span>')
                html.append('            </div>')

            # Notes
            if 'notes' in bookmark and bookmark['notes']:
                html.append(f'            <div class="notes">{bookmark["notes"]}</div>')

            # Meta
            html.append('            <div class="meta">')
            html.append(f'                Created: {bookmark["created_at"]}')
            if bookmark.get('is_favorite'):
                html.append(' | Favorite')
            if bookmark.get('is_archived'):
                html.append(' | Archived')
            html.append('            </div>')

            html.append('        </div>')

        html.extend(['    </div>',
                     '</body>',
                     '</html>'])

        return '\n'.join(html)

    def _generate_csv_export(self, bookmarks):
        """Generate CSV export of bookmarks"""
        import csv
        from io import StringIO

        output = StringIO()
        fieldnames = ['title', 'url', 'description', 'created_at', 'domain',
                      'is_favorite', 'is_archived', 'is_read', 'tags', 'notes']

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for bookmark in bookmarks:
            # Format tags as comma-separated string
            if 'tags' in bookmark and isinstance(bookmark['tags'], list):
                bookmark['tags'] = ', '.join(bookmark['tags'])

            writer.writerow(bookmark)

        return output.getvalue()

    def _process_merge(self, job, bookmark_ids):
        """Merge duplicate bookmarks"""
        from .duplicates import DuplicateManager

        primary_id = job.parameters.get('primary_id')
        if not primary_id:
            return {
                'success': False,
                'error': 'No primary bookmark specified',
                'processed_count': 0
            }

        # Make sure primary bookmark is in the list
        if primary_id not in bookmark_ids:
            return {
                'success': False,
                'error': 'Primary bookmark not in selected bookmarks',
                'processed_count': 0
            }

        # Remove primary from duplicates
        duplicate_ids = [bid for bid in bookmark_ids if bid != primary_id]
        if not duplicate_ids:
            return {
                'success': False,
                'error': 'No duplicate bookmarks to merge',
                'processed_count': 0
            }

        # Perform merge
        try:
            duplicate_manager = DuplicateManager()
            result = duplicate_manager.merge_bookmarks(primary_id, duplicate_ids)

            return {
                'success': True,
                'processed_count': len(duplicate_ids),
                'primary_bookmark': {
                    'id': str(result.id),
                    'title': result.title,
                    'url': result.url
                },
                'merged_count': len(duplicate_ids)
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processed_count': 0
            }


def create_bulk_action_job(user, action_type, bookmark_ids, parameters=None):
    """Create a new bulk action job"""
    if not parameters:
        parameters = {}

    # Create the job
    job = BulkActionJob.objects.create(
        user=user,
        action_type=action_type,
        bookmark_ids=bookmark_ids,
        parameters=parameters,
        total_items=len(bookmark_ids)
    )

    return job


def process_bulk_action_job(job_id):
    """Process a bulk action job"""
    processor = BulkActionProcessor(job_id)
    return processor.start_job()


def get_bulk_action_job(job_id, user_id=None):
    """Get a bulk action job by ID"""
    query = BulkActionJob.objects.filter(id=job_id)
    if user_id:
        query = query.filter(user_id=user_id)

    return query.first()
