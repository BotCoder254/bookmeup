from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Q, Count
from django.utils import timezone
from django.conf import settings
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from datetime import timedelta, datetime
import hashlib
import logging

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination

from .models import Bookmark, Tag, Collection, BookmarkActivity, SavedView, BoardLayout, BookmarkHighlight, BookmarkNote, BookmarkHistoryEntry, LinkHealth
from .serializers import (
    BookmarkSerializer, TagSerializer, CollectionSerializer,
    BookmarkActivitySerializer, UserSerializer, BookmarkCreateSerializer,
    BookmarkStatsSerializer, SavedViewSerializer, SearchResultSerializer,
    SearchSuggestionSerializer, BoardLayoutSerializer, BookmarkHighlightSerializer,
    BookmarkNoteSerializer, BookmarkHistoryEntrySerializer, LinkHealthSerializer,
    LinkHealthStatsSerializer, BulkActionJobSerializer
)
from .utils import enrich_url
from .search import BookmarkSearchEngine, get_search_syntax_help
from .duplicates import DuplicateManager
from .link_health import LinkHealthChecker, LinkHealthRepair, get_bookmark_health_summary, run_link_health_check
from .bulk_actions import create_bulk_action_job, process_bulk_action_job, get_bulk_action_job
import time

logger = logging.getLogger(__name__)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CursorPagination(PageNumberPagination):
    """Cursor-based pagination for better performance"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 50

    def get_paginated_response(self, data):
        return Response({
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'count': self.page.paginator.count,
            'page_size': self.page_size,
            'current_page': self.page.number,
            'total_pages': self.page.paginator.num_pages,
            'results': data
        })


@api_view(['POST'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def login_view(request):
    """User login endpoint"""
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'error': 'Username and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(request, username=username, password=password)
    if user:
        login(request, user)
        csrf_token = get_token(request)
        user_data = UserSerializer(user).data
        user_data['csrf_token'] = csrf_token
        return Response({
            'message': 'Login successful',
            'user': user_data
        })
    else:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """User registration endpoint"""
    # Check if registration is allowed
    if getattr(settings, 'SINGLE_USER_MODE', False) and not getattr(settings, 'ALLOW_REGISTRATION', False):
        return Response(
            {'error': 'Registration is disabled in single-user mode'},
            status=status.HTTP_403_FORBIDDEN
        )

    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    first_name = request.data.get('first_name', '')
    last_name = request.data.get('last_name', '')

    if not username or not email or not password:
        return Response(
            {'error': 'Username, email, and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(username=username).exists():
        return Response(
            {'error': 'Username already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(email=email).exists():
        return Response(
            {'error': 'Email already registered'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name
    )

    login(request, user)
    return Response({
        'message': 'Registration successful',
        'user': UserSerializer(user).data
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def auto_login_view(request):
    """Auto-login for single-user mode"""
    if not getattr(settings, 'SINGLE_USER_MODE', False):
        return Response(
            {'error': 'Auto-login only available in single-user mode'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Ensure CSRF token is available
        csrf_token = get_token(request)

        # Find the admin user
        admin_user = User.objects.filter(is_staff=True, is_superuser=True).first()
        if admin_user:
            login(request, admin_user)
            user_data = UserSerializer(admin_user).data
            user_data['csrf_token'] = csrf_token
            return Response({
                'message': 'Auto-login successful',
                'user': user_data
            })
        else:
            return Response(
                {'error': 'No admin user found', 'csrf_token': csrf_token},
                status=status.HTTP_404_NOT_FOUND
            )
    except Exception as e:
        return Response(
            {'error': f'Auto-login failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """User logout endpoint"""
    logout(request)
    return Response({'message': 'Logout successful'})


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def me_view(request):
    """Get current user info and ensure CSRF cookie is set"""
    # Ensure CSRF token is available
    csrf_token = get_token(request)

    # Auto-login for single-user mode
    if getattr(settings, 'SINGLE_USER_MODE', False) and not request.user.is_authenticated:
        # Try to auto-login the single user
        try:
            admin_user = User.objects.filter(is_staff=True, is_superuser=True).first()
            if admin_user:
                login(request, admin_user)
                user_data = UserSerializer(admin_user).data
                user_data['single_user_mode'] = True
                user_data['allow_registration'] = getattr(settings, 'ALLOW_REGISTRATION', False)
                user_data['csrf_token'] = csrf_token
                return Response(user_data)
        except Exception as e:
            logger.warning(f'Auto-login failed: {e}')

    if not request.user.is_authenticated:
        return Response({
            'error': 'Not authenticated',
            'csrf_token': csrf_token,
            'single_user_mode': getattr(settings, 'SINGLE_USER_MODE', False)
        }, status=status.HTTP_401_UNAUTHORIZED)

    user_data = UserSerializer(request.user).data
    user_data['single_user_mode'] = getattr(settings, 'SINGLE_USER_MODE', False)
    user_data['allow_registration'] = getattr(settings, 'ALLOW_REGISTRATION', False)
    user_data['csrf_token'] = csrf_token
    return Response(user_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quick_add_bookmark(request):
    """Quick add bookmark with URL enrichment"""
    url = request.data.get('url')
    title = request.data.get('title', '')
    description = request.data.get('description', '')
    tag_ids = request.data.get('tag_ids', [])
    collection_id = request.data.get('collection_id')
    is_favorite = request.data.get('is_favorite', False)

    if not url:
        return Response(
            {'error': 'URL is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Enrich URL metadata
        metadata = enrich_url(url)
        normalized_url = metadata['normalized_url']

        # Create URL hash for deduplication
        url_hash = hashlib.sha256(normalized_url.encode()).hexdigest()

        # Check for existing bookmark
        existing_bookmark = Bookmark.objects.filter(
            user=request.user,
            url=normalized_url
        ).first()

        if existing_bookmark:
            # Update existing bookmark with new metadata if not user-edited
            if not title and metadata.get('title'):
                existing_bookmark.title = metadata['title']
            if not description and metadata.get('description'):
                existing_bookmark.description = metadata['description']
            if metadata.get('favicon_url'):
                existing_bookmark.favicon_url = metadata['favicon_url']
            if metadata.get('image_url'):
                existing_bookmark.screenshot_url = metadata['image_url']

            existing_bookmark.save()

            # Add tags if provided
            if tag_ids:
                tags = Tag.objects.filter(id__in=tag_ids, user=request.user)
                existing_bookmark.tags.add(*tags)

            return Response(
                BookmarkSerializer(existing_bookmark).data,
                status=status.HTTP_200_OK
            )

        # Create new bookmark
        bookmark_data = {
            'url': normalized_url,
            'title': title or metadata.get('title', ''),
            'description': description or metadata.get('description', ''),
            'favicon_url': metadata.get('favicon_url', ''),
            'screenshot_url': metadata.get('image_url', ''),
            'is_favorite': is_favorite,
            'user': request.user
        }

        if collection_id:
            try:
                collection = Collection.objects.get(id=collection_id, user=request.user)
                bookmark_data['collection'] = collection
            except Collection.DoesNotExist:
                pass

        bookmark = Bookmark.objects.create(**bookmark_data)

        # Add tags
        if tag_ids:
            tags = Tag.objects.filter(id__in=tag_ids, user=request.user)
            bookmark.tags.set(tags)

        # Log activity
        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=request.user,
            activity_type='created',
            metadata={'source': 'quick_add', 'enriched': True}
        )

        return Response(
            BookmarkSerializer(bookmark).data,
            status=status.HTTP_201_CREATED
        )

    except ValueError as e:
        # URL enrichment failed, create basic bookmark
        bookmark_data = {
            'url': url,
            'title': title or url,
            'description': description,
            'is_favorite': is_favorite,
            'user': request.user
        }

        if collection_id:
            try:
                collection = Collection.objects.get(id=collection_id, user=request.user)
                bookmark_data['collection'] = collection
            except Collection.DoesNotExist:
                pass

        bookmark = Bookmark.objects.create(**bookmark_data)

        if tag_ids:
            tags = Tag.objects.filter(id__in=tag_ids, user=request.user)
            bookmark.tags.set(tags)

        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=request.user,
            activity_type='created',
            metadata={'source': 'quick_add', 'enriched': False, 'error': str(e)}
        )

        return Response(
            BookmarkSerializer(bookmark).data,
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        logger.error(f"Error in quick_add_bookmark: {str(e)}")
        return Response(
            {'error': 'Failed to create bookmark'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class BookmarkViewSet(viewsets.ModelViewSet):
    serializer_class = BookmarkSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = CursorPagination

    def get_queryset(self):
        # Don't use select_related for collection to avoid missing field issues
        queryset = Bookmark.objects.filter(user=self.request.user).prefetch_related('tags')

        # Filter by various parameters
        is_favorite = self.request.query_params.get('is_favorite')
        is_archived = self.request.query_params.get('is_archived')
        collection_id = self.request.query_params.get('collection')
        tag_ids = self.request.query_params.getlist('tags')
        search = self.request.query_params.get('search')
        domain = self.request.query_params.get('domain')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        read_state = self.request.query_params.get('read_state')
        health_status = self.request.query_params.get('health_status')

        if is_favorite is not None:
            queryset = queryset.filter(is_favorite=is_favorite.lower() == 'true')

        if is_archived is not None:
            queryset = queryset.filter(is_archived=is_archived.lower() == 'true')

        if collection_id:
            queryset = queryset.filter(collection_id=collection_id)

        if tag_ids:
            queryset = queryset.filter(tags__id__in=tag_ids).distinct()

        if domain:
            queryset = queryset.filter(domain__icontains=domain)

        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)

        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        if read_state:
            if read_state.lower() == 'read':
                queryset = queryset.filter(visited_at__isnull=False)
            elif read_state.lower() == 'unread':
                queryset = queryset.filter(visited_at__isnull=True)

        # Filter by link health status
        if health_status:
            if health_status == 'broken':
                queryset = queryset.filter(health__status='broken')
            elif health_status == 'redirected':
                queryset = queryset.filter(health__status='redirected')
            elif health_status == 'ok':
                queryset = queryset.filter(health__status='ok')
            elif health_status == 'pending':
                queryset = queryset.filter(health__status='pending')
            elif health_status == 'unchecked':
                queryset = queryset.filter(health__isnull=True)

        # Filter by duplicate IDs if they exist in the filter
        # This is used by the Duplicates smart view
        duplicate_ids = self.request.query_params.getlist('duplicate_ids')
        if duplicate_ids:
            queryset = queryset.filter(id__in=duplicate_ids)

        # Filter by broken link IDs if they exist in the filter
        # This is used by the Broken Links smart view
        broken_link_ids = self.request.query_params.getlist('broken_link_ids')
        if broken_link_ids:
            queryset = queryset.filter(id__in=broken_link_ids)

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(url__icontains=search) |
                Q(tags__name__icontains=search)
            ).distinct()

        # Default ordering by creation date (newest first)
        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return BookmarkCreateSerializer
        return BookmarkSerializer

    def perform_create(self, serializer):
        bookmark = serializer.save()
        # Log activity
        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=self.request.user,
            activity_type='created'
        )

    def perform_update(self, serializer):
        bookmark = serializer.save()
        # Log activity
        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=self.request.user,
            activity_type='updated'
        )

    @action(detail=True, methods=['post'])
    def toggle_favorite(self, request, pk=None):
        """Toggle bookmark favorite status"""
        bookmark = self.get_object()
        bookmark.is_favorite = not bookmark.is_favorite
        bookmark.save()

        activity_type = 'favorited' if bookmark.is_favorite else 'unfavorited'
        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=request.user,
            activity_type=activity_type
        )

        return Response({'is_favorite': bookmark.is_favorite})

    @action(detail=True, methods=['post'])
    def toggle_archive(self, request, pk=None):
        bookmark = self.get_object()
        bookmark.is_archived = not bookmark.is_archived
        bookmark.save()

        # Record activity
        activity_type = 'archived' if bookmark.is_archived else 'unarchived'
        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=request.user,
            activity_type=activity_type
        )

        serializer = self.get_serializer(bookmark)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def annotations(self, request, pk=None):
        bookmark = self.get_object()

        if request.method == 'GET':
            highlights = BookmarkHighlight.objects.filter(
                bookmark=bookmark,
                user=request.user
            )
            serializer = BookmarkHighlightSerializer(highlights, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            data = request.data.copy()
            data['bookmark'] = bookmark.id
            serializer = BookmarkHighlightSerializer(data=data, context={'request': request})

            if serializer.is_valid():
                serializer.save()
                # Record visit/activity
                bookmark.visited_at = datetime.now()
                bookmark.save()

                BookmarkActivity.objects.create(
                    bookmark=bookmark,
                    user=request.user,
                    activity_type='visited',
                    metadata={'action': 'added_highlight'}
                )

                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def visit(self, request, pk=None):
        """Mark bookmark as visited"""
        bookmark = self.get_object()
        bookmark.visited_at = timezone.now()
        bookmark.save()

        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=request.user,
            activity_type='visited'
        )

        return Response({'visited_at': bookmark.visited_at})

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Advanced search endpoint with full-text search and smart filters"""
        start_time = time.time()

        query = request.query_params.get('q', '')
        fuzzy = request.query_params.get('fuzzy', 'false').lower() == 'true'
        find_duplicates = request.query_params.get('duplicates', 'false').lower() == 'true'

        # Initialize search engine
        search_engine = BookmarkSearchEngine(request.user)

        # Perform search
        queryset = search_engine.search(query, fuzzy=fuzzy, find_duplicates=find_duplicates)

        # Parse filters for response metadata
        filters, text_query = search_engine.parse_search_query(query)

        # Paginate results
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = BookmarkSerializer(page, many=True, context={'request': request})
            search_time = time.time() - start_time

            response_data = {
                'bookmarks': serializer.data,
                'total_count': queryset.count(),
                'search_time': round(search_time, 3),
                'filters_applied': filters,
                'text_query': text_query
            }

            return self.get_paginated_response(response_data)

        serializer = BookmarkSerializer(queryset, many=True, context={'request': request})
        search_time = time.time() - start_time

        return Response({
            'bookmarks': serializer.data,
            'total_count': queryset.count(),
            'search_time': round(search_time, 3),
            'filters_applied': filters,
            'text_query': text_query
        })

    @action(detail=False, methods=['get'])
    def search_suggestions(self, request):
        """Get search suggestions and syntax help"""
        partial_query = request.query_params.get('q', '')

        search_engine = BookmarkSearchEngine(request.user)
        suggestions = search_engine.get_search_suggestions(partial_query)
        syntax_help = get_search_syntax_help()

        return Response({
            'suggestions': suggestions,
            'syntax_help': syntax_help
        })

    @action(detail=True, methods=['get', 'post'])
    def bookmark_notes(self, request, pk=None):
        """Get or create notes for a specific bookmark"""
        bookmark = self.get_object()
        from .models import BookmarkNote
        from rest_framework import serializers

        class NoteSerializer(serializers.ModelSerializer):
            class Meta:
                model = BookmarkNote
                fields = ['id', 'content', 'plain_text', 'created_at', 'updated_at', 'is_active']

        if request.method == 'GET':
            notes = BookmarkNote.objects.filter(
                bookmark=bookmark,
                user=request.user
            ).order_by('-updated_at')

            serializer = NoteSerializer(notes, many=True)
            return Response({'results': serializer.data})

        elif request.method == 'POST':
            content = request.data.get('content', '').strip()

            if not content:
                return Response(
                    {'error': 'Note content is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            import re
            # Generate plain text from content (simple HTML tag removal)
            plain_text = re.sub(r'<[^>]+>', '', content)

            # Check for existing active note
            existing_note = BookmarkNote.objects.filter(
                bookmark=bookmark,
                user=request.user,
                is_active=True
            ).first()

            if existing_note:
                # Create revision of existing note
                existing_note.create_revision()

                # Update existing note
                existing_note.content = content
                existing_note.plain_text = plain_text
                existing_note.save()

                return Response({'message': 'Note updated successfully', 'id': existing_note.id})
            else:
                # Create new note
                note = BookmarkNote.objects.create(
                    bookmark=bookmark,
                    user=request.user,
                    content=content,
                    plain_text=plain_text,
                    is_active=True
                )

                return Response(
                    {'message': 'Note created successfully', 'id': note.id},
                    status=status.HTTP_201_CREATED
                )

    # This action has been consolidated with the GET method above

    @action(detail=True, methods=['get'])
    def snapshot(self, request, pk=None):
        """Get reader snapshot for a bookmark"""
        bookmark = self.get_object()
        from .models import BookmarkSnapshot

        # Try to find an existing snapshot
        snapshot = BookmarkSnapshot.objects.filter(
            bookmark=bookmark,
            status='completed'
        ).order_by('-created_at').first()

        # If no snapshot exists, create one automatically
        if not snapshot:
            try:
                # Create a new snapshot with placeholder content
                snapshot = BookmarkSnapshot.objects.create(
                    bookmark=bookmark,
                    html_content=f"<h1>{bookmark.title}</h1><p>{bookmark.description or 'No description available.'}</p>",
                    plain_text=f"{bookmark.title}\n{bookmark.description or 'No description available.'}",
                    status='completed'
                )
            except Exception as e:
                return Response(
                    {'error': f'Could not create snapshot: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        from rest_framework import serializers

        class SnapshotSerializer(serializers.ModelSerializer):
            class Meta:
                model = BookmarkSnapshot
                fields = ['id', 'html_content', 'created_at', 'status']

        serializer = SnapshotSerializer(snapshot)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def duplicates(self, request):
        """Detect and return duplicate bookmarks for the user"""
        duplicate_manager = DuplicateManager()
        duplicate_groups = duplicate_manager.detect_duplicates(request.user.id)

        # Format the response
        formatted_groups = []
        for group in duplicate_groups:
            # Convert bookmarks to serialized data
            serializer = self.get_serializer(group['bookmarks'], many=True)

            group_data = {
                'bookmarks': serializer.data
            }

            # Add any additional group metadata
            if 'normalized_url' in group:
                group_data['normalized_url'] = group['normalized_url']
                group_data['type'] = 'url_duplicate'
            elif 'title_similarity' in group:
                group_data['type'] = 'title_similar'

            formatted_groups.append(group_data)

        return Response({
            'duplicate_groups': formatted_groups,
            'count': len(formatted_groups)
        })

    @action(detail=False, methods=['post'])
    def merge(self, request):
        """Merge duplicate bookmarks"""
        primary_id = request.data.get('primary_id')
        duplicate_ids = request.data.get('duplicate_ids', [])

        # Log the raw incoming data
        logger.info(f"Received merge request with raw data: primary_id={primary_id}, duplicate_ids={duplicate_ids} (type: {type(duplicate_ids)})")

        # Handle string-formatted duplicate_ids (from form data or JSON string)
        if isinstance(duplicate_ids, str):
            try:
                import json
                duplicate_ids = json.loads(duplicate_ids)
                logger.info(f"Parsed duplicate_ids from JSON string: {duplicate_ids}")
            except:
                duplicate_ids = [duplicate_ids]
                logger.info(f"Could not parse JSON, treating as single value: {duplicate_ids}")

        # Log the incoming request
        logger.info(f"Merge bookmarks request: primary_id={primary_id}, duplicate_ids={duplicate_ids}")

        if not primary_id or not duplicate_ids:
            logger.warning(f"Missing required parameters: primary_id={primary_id}, duplicate_ids={duplicate_ids}")
            return Response(
                {'error': 'Both primary_id and duplicate_ids are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Remove primary bookmark from duplicates list if present
        if not isinstance(duplicate_ids, list):
            duplicate_ids = [duplicate_ids]

        # Convert all IDs to strings for consistent comparison
        primary_id_str = str(primary_id)
        duplicate_ids = [str(d_id) for d_id in duplicate_ids]

        original_count = len(duplicate_ids)
        duplicate_ids = [d_id for d_id in duplicate_ids if d_id != primary_id_str]

        if len(duplicate_ids) < original_count:
            logger.info(f"Removed primary bookmark {primary_id} from duplicates list")

        if not duplicate_ids:
            logger.warning("No valid duplicates to merge after filtering")
            return Response(
                {'error': 'Cannot merge a bookmark with itself. Please select different bookmarks to merge.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Log what we're actually querying
            logger.info(f"Querying for primary ID: {primary_id} (type: {type(primary_id)})")
            logger.info(f"Querying for duplicates: {duplicate_ids} (types: {[type(d_id) for d_id in duplicate_ids]})")

            # Verify all bookmarks belong to the requesting user
            primary_bookmark = Bookmark.objects.get(id=primary_id, user=request.user)
            duplicates = Bookmark.objects.filter(id__in=duplicate_ids, user=request.user)

            found_ids = set(str(id) for id in duplicates.values_list('id', flat=True))
            missing_ids = set(duplicate_ids) - found_ids

            if missing_ids:
                logger.warning(f"Duplicate bookmarks not found or not owned by user: {missing_ids}")
                return Response(
                    {'error': 'One or more duplicate bookmarks not found or not owned by you',
                     'missing_ids': list(missing_ids)},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Perform the merge
            try:
                logger.info(f"About to merge primary {primary_id} with duplicates {duplicate_ids}")
                duplicate_manager = DuplicateManager()
                updated_bookmark = duplicate_manager.merge_bookmarks(primary_id, duplicate_ids)

                # Return the updated primary bookmark
                serializer = BookmarkSerializer(updated_bookmark, context={'request': request})
                logger.info(f"Successfully merged {len(duplicate_ids)} bookmarks into {primary_id}")
                return Response({
                    'message': f'Successfully merged {len(duplicate_ids)} bookmarks',
                    'bookmark': serializer.data
                })
            except ValueError as e:
                if "Cannot merge a bookmark with itself" in str(e):
                    return Response(
                        {'error': 'Cannot merge a bookmark with itself'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                raise  # Re-raise for other ValueError cases

        except Bookmark.DoesNotExist:
            logger.error(f"Primary bookmark not found: {primary_id}")
            return Response(
                {'error': 'Primary bookmark not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            # Handle validation errors from the merge_bookmarks function
            logger.error(f"Validation error during merge: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error merging bookmarks: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Error merging bookmarks: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def snapshot_generate(self, request, pk=None):
        """Generate a new snapshot for a bookmark"""
        bookmark = self.get_object()
        from .models import BookmarkSnapshot
        import requests
        import re
        from bs4 import BeautifulSoup

        try:
            # Create pending snapshot
            snapshot = BookmarkSnapshot.objects.create(
                bookmark=bookmark,
                html_content="<div>Processing content...</div>",
                plain_text="Processing content...",
                status='pending'
            )

            try:
                # Try to fetch the content from the URL
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                }
                response = requests.get(bookmark.url, headers=headers, timeout=10)
                response.raise_for_status()

                # Parse the HTML
                soup = BeautifulSoup(response.text, 'html.parser')

                # Remove scripts, styles, and other unwanted elements
                for element in soup(['script', 'style', 'nav', 'footer', 'iframe']):
                    element.decompose()

                # Extract the main content
                main_content = soup.find('main') or soup.find('article') or soup.find('div', class_='content')

                if not main_content:
                    # Try to find content by looking for the largest text block
                    paragraphs = soup.find_all('p')
                    if paragraphs:
                        main_content = max(paragraphs, key=lambda p: len(p.get_text()))
                        # Get the parent container that might have the full article
                        for _ in range(3):  # Go up to 3 levels up
                            if main_content.parent and len(main_content.parent.get_text()) > len(main_content.get_text()) * 1.5:
                                main_content = main_content.parent
                            else:
                                break

                # If still nothing found, use the body
                if not main_content or len(main_content.get_text()) < 100:
                    main_content = soup.body

                # Clean up the HTML
                html_content = str(main_content)

                # Generate plain text
                plain_text = main_content.get_text(separator='\n', strip=True)

                # Update the snapshot
                snapshot.html_content = html_content
                snapshot.plain_text = plain_text
                snapshot.status = 'completed'
                snapshot.save()

            except Exception as e:
                # If fetching fails, create a basic snapshot with the title and description
                snapshot.html_content = f"<h1>{bookmark.title}</h1><p>{bookmark.description or ''}</p>"
                snapshot.plain_text = f"{bookmark.title}\n{bookmark.description or ''}"
                snapshot.status = 'completed'
                snapshot.save()

            return Response({
                'message': 'Snapshot generation completed',
                'id': snapshot.id,
                'status': snapshot.status,
                'html_content': snapshot.html_content,
                'created_at': snapshot.created_at
            })

        except Exception as e:
            return Response({
                'error': f'Failed to generate snapshot: {str(e)}',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def related(self, request, pk=None):
        """Get related bookmarks based on domain and tags"""
        bookmark = self.get_object()

        # Get bookmarks from same domain
        domain_bookmarks = Bookmark.objects.filter(
            user=request.user,
            domain=bookmark.domain
        ).exclude(id=bookmark.id)[:5]

        # Get bookmarks with shared tags
        tag_ids = bookmark.tags.values_list('id', flat=True)
        tag_bookmarks = Bookmark.objects.filter(
            user=request.user,
            tags__id__in=tag_ids
        ).exclude(id=bookmark.id).distinct()[:5]

        # Combine and deduplicate
        related_bookmarks = list(domain_bookmarks) + [b for b in tag_bookmarks if b not in domain_bookmarks]
        related_bookmarks = related_bookmarks[:10]  # Limit to 10 total

        serializer = BookmarkSerializer(related_bookmarks, many=True, context={'request': request})
        return Response({'results': serializer.data})

    @action(detail=False, methods=['get'])
    def library(self, request):
        """Lightweight endpoint for library view with cursor pagination"""
        queryset = self.get_queryset()

        # Only return essential fields for library view (exclude collection fields for now)
        bookmarks = queryset.values(
            'id', 'title', 'url', 'domain', 'favicon_url', 'screenshot_url',
            'is_favorite', 'is_archived', 'created_at', 'visited_at'
        )

        # Add tags separately to avoid N+1 queries
        bookmark_ids = [b['id'] for b in bookmarks]
        tags_dict = {}
        if bookmark_ids:
            # Use Django ORM to handle UUID conversion properly
            from .models import Bookmark
            bookmark_tags = Bookmark.objects.filter(
                id__in=bookmark_ids
            ).prefetch_related('tags').values(
                'id', 'tags__id', 'tags__name', 'tags__color'
            )

            for item in bookmark_tags:
                bookmark_id = item['id']
                if item['tags__id'] is not None:  # Skip bookmarks without tags
                    if bookmark_id not in tags_dict:
                        tags_dict[bookmark_id] = []
                    tags_dict[bookmark_id].append({
                        'id': item['tags__id'],
                        'name': item['tags__name'],
                        'color': item['tags__color']
                    })

        # Add tags to bookmarks
        for bookmark in bookmarks:
            bookmark['tags'] = tags_dict.get(bookmark['id'], [])

        page = self.paginate_queryset(list(bookmarks))
        if page is not None:
            return self.get_paginated_response(page)

        return Response(list(bookmarks))


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Order by name as fallback if order field doesn't exist
        queryset = Tag.objects.filter(user=self.request.user)
        try:
            # Try to order by order field if it exists
            return queryset.order_by('order', 'name')
        except:
            # Fall back to name ordering if order field doesn't exist
            return queryset.order_by('name')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # Handle safe rename by updating all related bookmarks
        old_instance = self.get_object()
        new_name = serializer.validated_data.get('name')

        if old_instance.name != new_name:
            # Log the rename for potential rollback
            logger.info(f"Renaming tag '{old_instance.name}' to '{new_name}' for user {self.request.user.username}")

        serializer.save()

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Batch reorder tags"""
        tag_orders = request.data.get('tag_orders', [])

        # Validate all tag IDs belong to the user
        tag_ids = [item.get('id') for item in tag_orders]
        user_tags = Tag.objects.filter(id__in=tag_ids, user=request.user)

        if len(user_tags) != len(tag_ids):
            return Response(
                {'error': 'Some tags do not belong to you'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Batch update orders
        for item in tag_orders:
            tag_id = item.get('id')
            order = item.get('order')

            Tag.objects.filter(id=tag_id, user=request.user).update(order=order)

        return Response({'message': 'Tags reordered successfully'})

    @action(detail=False, methods=['get'])
    def recent_suggestions(self, request):
        """Get recently used tags for suggestions"""
        # Get tags from recently created bookmarks
        recent_tags = Tag.objects.filter(
            user=request.user,
            bookmarks__created_at__gte=timezone.now() - timedelta(days=30)
        ).distinct().order_by('-bookmarks__created_at')[:10]

        serializer = TagSerializer(recent_tags, many=True, context={'request': request})
        return Response(serializer.data)


class CollectionViewSet(viewsets.ModelViewSet):
    serializer_class = CollectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Order by name as fallback if order field doesn't exist
        queryset = Collection.objects.filter(user=self.request.user)
        try:
            # Try to order by order field if it exists
            return queryset.order_by('order', 'name')
        except:
            # Fall back to name ordering if order field doesn't exist
            return queryset.order_by('name')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # Handle safe rename by updating all related bookmarks
        old_instance = self.get_object()
        new_name = serializer.validated_data.get('name')

        if old_instance.name != new_name:
            # Log the rename for potential rollback
            logger.info(f"Renaming collection '{old_instance.name}' to '{new_name}' for user {self.request.user.username}")

        serializer.save()

    @action(detail=False, methods=['get'])
    def duplicates_view(self, request):
        """Get or create the Duplicates smart view"""
        try:
            # Check if the view already exists
            duplicates_view = SavedView.objects.get(
                user=request.user,
                name="Duplicates"
            )
        except SavedView.DoesNotExist:
            # Create the view if it doesn't exist
            duplicate_manager = DuplicateManager()
            duplicate_groups = duplicate_manager.detect_duplicates(request.user.id)

            # Generate a list of bookmark IDs that are duplicates
            duplicate_ids = []
            for group in duplicate_groups:
                for bookmark in group['bookmarks']:
                    duplicate_ids.append(str(bookmark.id))

            # Create the view
            duplicates_view = SavedView.objects.create(
                user=request.user,
                name="Duplicates",
                description=f"Bookmarks with duplicate URLs or similar titles ({len(duplicate_ids)} found)",
                filters={'duplicate_ids': duplicate_ids},
                icon="copy",
                is_system=True,
                order=1  # High priority in the sidebar
            )

        serializer = self.get_serializer(duplicates_view)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Batch reorder collections"""
        collection_orders = request.data.get('collection_orders', [])

        # Validate all collection IDs belong to the user
        collection_ids = [item.get('id') for item in collection_orders]
        user_collections = Collection.objects.filter(id__in=collection_ids, user=request.user)

        if len(user_collections) != len(collection_ids):
            return Response(
                {'error': 'Some collections do not belong to you'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Batch update orders
        for item in collection_orders:
            collection_id = item.get('id')
            order = item.get('order')

            Collection.objects.filter(id=collection_id, user=request.user).update(order=order)

        return Response({'message': 'Collections reordered successfully'})

    @action(detail=True, methods=['post'])
    def set_cover_image(self, request, pk=None):
        """Set custom cover image for collection"""
        collection = self.get_object()
        cover_image_url = request.data.get('cover_image')

        if not cover_image_url:
            return Response(
                {'error': 'cover_image URL is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if cover_image field exists before trying to set it
        if hasattr(collection, 'cover_image'):
            collection.cover_image = cover_image_url
            collection.save()

            cover_image_response = collection.cover_image
            # Check if get_cover_image method exists
            if hasattr(collection, 'get_cover_image'):
                cover_image_url_response = collection.get_cover_image()
            else:
                cover_image_url_response = collection.cover_image
        else:
            return Response(
                {'error': 'Cover image feature not available yet'},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        return Response({
            'message': 'Cover image updated successfully',
            'cover_image': cover_image_response,
            'cover_image_url': cover_image_url_response
        })


class BookmarkActivityViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BookmarkActivitySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return BookmarkActivity.objects.filter(user=self.request.user)


class SavedViewViewSet(viewsets.ModelViewSet):
    """ViewSet for managing saved search views"""
    serializer_class = SavedViewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedView.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def use_view(self, request, pk=None):
        """Mark a saved view as used (updates last_used timestamp)"""
        saved_view = self.get_object()
        saved_view.last_used = timezone.now()
        saved_view.save()

        return Response({
            'message': 'View used successfully',
            'last_used': saved_view.last_used
        })

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder saved views"""
        view_orders = request.data.get('view_orders', [])

        for item in view_orders:
            view_id = item.get('id')
            order = item.get('order')

            try:
                saved_view = SavedView.objects.get(
                    id=view_id,
                    user=request.user
                )
                saved_view.order = order
                saved_view.save()
            except SavedView.DoesNotExist:
                continue

        return Response({'message': 'Views reordered successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def duplicate_bookmark(request, pk):
    """Duplicate a bookmark and return the new copy"""
    try:
        # Get the original bookmark
        original_bookmark = Bookmark.objects.get(id=pk, user=request.user)

        # Extract base URL and add a timestamp to create a unique URL
        from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
        import time

        # Parse the URL
        parsed_url = urlparse(original_bookmark.url)

        # Get existing query parameters
        query_params = parse_qs(parsed_url.query)

        # Add a unique timestamp parameter to ensure uniqueness
        timestamp = int(time.time() * 1000)
        query_params['_dup'] = [str(timestamp)]

        # Also add original bookmark ID for reference
        query_params['_dup_from'] = [str(original_bookmark.id)]

        # Rebuild the URL with updated query parameters
        unique_url = urlunparse(
            (
                parsed_url.scheme,
                parsed_url.netloc,
                parsed_url.path,
                parsed_url.params,
                urlencode(query_params, doseq=True),
                parsed_url.fragment
            )
        )

        # Create a new bookmark with the same properties but unique URL
        new_bookmark = Bookmark.objects.create(
            user=request.user,
            title=f"{original_bookmark.title} (Copy)",
            url=unique_url,
            description=original_bookmark.description,
            notes=original_bookmark.notes,
            content=original_bookmark.content,
            favicon_url=original_bookmark.favicon_url,
            screenshot_url=original_bookmark.screenshot_url,
            domain=original_bookmark.domain,
            collection=original_bookmark.collection
        )

        # Copy tags
        new_bookmark.tags.set(original_bookmark.tags.all())

        # Log activity
        BookmarkActivity.objects.create(
            bookmark=new_bookmark,
            user=request.user,
            activity_type='created',
            metadata={
                'duplicated_from': str(original_bookmark.id),
                'original_url': original_bookmark.url,
                'original_title': original_bookmark.title
            }
        )

        # Force a refresh of the duplicate detection
        duplicate_manager = DuplicateManager()
        duplicate_groups = duplicate_manager.detect_duplicates(request.user.id)

        # Update any existing Duplicates saved view
        try:
            duplicate_ids = []
            for group in duplicate_groups:
                for duplicate_bookmark in group['bookmarks']:
                    duplicate_ids.append(str(duplicate_bookmark.id))

            duplicates_view = SavedView.objects.get(
                user=request.user,
                name="Duplicates"
            )

            # Update the view with fresh duplicate IDs
            duplicates_view.filters = {'duplicate_ids': duplicate_ids}
            duplicates_view.description = f"Bookmarks with duplicate URLs or similar titles ({len(duplicate_ids)} found)"
            duplicates_view.save()
        except SavedView.DoesNotExist:
            # Create the view if it doesn't exist
            if duplicate_ids:
                SavedView.objects.create(
                    user=request.user,
                    name="Duplicates",
                    description=f"Bookmarks with duplicate URLs or similar titles ({len(duplicate_ids)} found)",
                    filters={'duplicate_ids': duplicate_ids},
                    icon="copy",
                    is_system=True,
                    order=1
                )

        return Response(
            {
                'bookmark': BookmarkSerializer(new_bookmark, context={'request': request}).data,
                'original_bookmark_id': str(original_bookmark.id),
                'message': f"Successfully duplicated '{original_bookmark.title}'"
            },
            status=status.HTTP_201_CREATED
        )
    except Bookmark.DoesNotExist:
        return Response(
            {'error': 'Bookmark not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        # Handle unique constraint error specifically
        if 'UNIQUE constraint failed' in str(e):
            logger.error(f"Unique constraint error when duplicating bookmark: {str(e)}")
            return Response(
                {'error': 'You already have a bookmark with this URL. Cannot create duplicate.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        else:
            logger.error(f"Error duplicating bookmark: {str(e)}")
            return Response(
                {'error': f'Failed to duplicate bookmark: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bookmark_stats(request):
    """Get bookmark statistics for the current user"""
    user = request.user

    # Calculate statistics
    total_bookmarks = Bookmark.objects.filter(user=user).count()
    favorite_bookmarks = Bookmark.objects.filter(user=user, is_favorite=True).count()
    archived_bookmarks = Bookmark.objects.filter(user=user, is_archived=True).count()
    total_collections = Collection.objects.filter(user=user).count()
    total_tags = Tag.objects.filter(user=user).count()

    # Count duplicates
    from urllib.parse import urlparse, parse_qs
    duplicate_count = 0
    bookmarks = Bookmark.objects.filter(user=user)
    for bookmark in bookmarks:
        parsed_url = urlparse(bookmark.url)
        query_params = parse_qs(parsed_url.query)
        if '_dup' in query_params:
            duplicate_count += 1

    # Recent activity (last 7 days)
    week_ago = timezone.now() - timedelta(days=7)
    recent_activity_count = BookmarkActivity.objects.filter(
        user=user,
        timestamp__gte=week_ago
    ).count()

    # Top domains
    top_domains = Bookmark.objects.filter(user=user).values('domain').annotate(
        count=Count('domain')
    ).order_by('-count')[:10]

    stats = {
        'total_bookmarks': total_bookmarks,
        'favorite_bookmarks': favorite_bookmarks,
        'archived_bookmarks': archived_bookmarks,
        'duplicate_bookmarks': duplicate_count,
        'total_collections': total_collections,
        'total_tags': total_tags,
        'recent_activity_count': recent_activity_count,
        'top_domains': list(top_domains)
    }

    serializer = BookmarkStatsSerializer(stats)
    return Response(serializer.data)


class BookmarkHighlightViewSet(viewsets.ModelViewSet):
    """ViewSet for bookmark highlights/annotations"""
    serializer_class = BookmarkHighlightSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        """Return highlights for the current user"""
        return BookmarkHighlight.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

        # Log activity when highlight is created
        bookmark = serializer.validated_data.get('bookmark')
        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=self.request.user,
            activity_type='visited',
            metadata={'action': 'created_highlight'}
        )


class BookmarkHistoryViewSet(viewsets.ModelViewSet):
    """ViewSet for bookmark browsing history"""
    serializer_class = BookmarkHistoryEntrySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        """Return history entries for the current user"""
        return BookmarkHistoryEntry.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

        # Update the bookmark's visited_at time
        bookmark = serializer.validated_data.get('bookmark')
        bookmark.visited_at = timezone.now()
        bookmark.save(update_fields=['visited_at'])

        # Log activity
        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=self.request.user,
            activity_type='visited',
            metadata={'from_history': True}
        )


class BulkActionJobViewSet(viewsets.ModelViewSet):
    """ViewSet for bulk action jobs"""
    serializer_class = BulkActionJobSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        """Return bulk action jobs for the current user"""
        return BulkActionJob.objects.filter(user=self.request.user)

    def create(self, request):
        """Create a new bulk action job"""
        action_type = request.data.get('action_type')
        bookmark_ids = request.data.get('bookmark_ids', [])
        parameters = request.data.get('parameters', {})

        # Validate action type
        valid_action_types = [choice[0] for choice in BulkActionJob.ACTION_TYPES]
        if action_type not in valid_action_types:
            return Response(
                {'error': f'Invalid action type. Must be one of: {", ".join(valid_action_types)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate bookmark IDs
        if not bookmark_ids:
            return Response(
                {'error': 'No bookmarks selected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the job
        job = create_bulk_action_job(
            user=request.user,
            action_type=action_type,
            bookmark_ids=bookmark_ids,
            parameters=parameters
        )

        # Start processing the job in the background
        # In a production environment, you would use a task queue like Celery
        # For now, we process it directly (blocking)
        try:
            process_bulk_action_job(job.id)
        except Exception as e:
            logger.error(f"Error processing bulk action job: {e}")

        serializer = self.get_serializer(job)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a pending or processing job"""
        job = self.get_object()

        if job.status not in ['pending', 'processing']:
            return Response(
                {'error': 'Can only cancel pending or processing jobs'},
                status=status.HTTP_400_BAD_REQUEST
            )

        job.status = 'cancelled'
        job.save(update_fields=['status', 'updated_at'])

        serializer = self.get_serializer(job)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Retry a failed job"""
        job = self.get_object()

        if job.status != 'failed':
            return Response(
                {'error': 'Can only retry failed jobs'},
                status=status.HTTP_400_BAD_REQUEST
            )

        job.status = 'pending'
        job.error_message = ''
        job.processed_items = 0
        job.save(update_fields=['status', 'error_message', 'processed_items', 'updated_at'])

        # Process the job
        try:
            process_bulk_action_job(job.id)
        except Exception as e:
            logger.error(f"Error processing bulk action job: {e}")

        # Refresh the job from database
        job.refresh_from_db()
        serializer = self.get_serializer(job)
        return Response(serializer.data)


class BoardLayoutViewSet(viewsets.ModelViewSet):
    """ViewSet for Visual Bookmark Board layouts"""
    serializer_class = BoardLayoutSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        """Return layouts for the current user"""
        return BoardLayout.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Deactivate any existing active layouts for this collection
        collection_id = serializer.validated_data.get('collection').id
        BoardLayout.objects.filter(
            collection_id=collection_id,
            user=self.request.user,
            is_active=True
        ).update(is_active=False)

        # Save the new layout
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # Only allow updating layout_data for active layouts
        instance = self.get_object()
        if instance.is_active:
            serializer.save()
        else:
            raise serializers.ValidationError("Cannot update inactive layouts")

    @action(detail=True, methods=['post'])
    def new_version(self, request, pk=None):
        """Save current layout as a new version"""
        layout = self.get_object()
        new_layout = layout.save_new_version()

        if new_layout:
            serializer = self.get_serializer(new_layout)
            return Response(serializer.data)

        return Response(
            {'error': 'Failed to create new layout version'},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=False, methods=['get'])
    def collection_layout(self, request):
        """Get active layout for a specific collection"""
        collection_id = request.query_params.get('collection_id')

        if not collection_id:
            return Response(
                {'error': 'collection_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            layout = BoardLayout.objects.get(
                collection_id=collection_id,
                user=request.user,
                is_active=True
            )
            serializer = self.get_serializer(layout)
            return Response(serializer.data)
        except BoardLayout.DoesNotExist:
            # Return empty success response - no layout exists yet
            return Response({})


class LinkHealthViewSet(viewsets.ModelViewSet):
    """ViewSet for bookmark link health status"""
    serializer_class = LinkHealthSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        """Return link health records for the current user's bookmarks"""
        queryset = LinkHealth.objects.filter(bookmark__user=self.request.user)

        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            if status_filter == 'broken':
                queryset = queryset.filter(status__in=['broken'])
            elif status_filter == 'redirected':
                queryset = queryset.filter(status='redirected')
            elif status_filter == 'ok':
                queryset = queryset.filter(status='ok')

        return queryset.order_by('-last_checked')

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get link health statistics"""
        summary = get_bookmark_health_summary(user_id=request.user.id)
        serializer = LinkHealthStatsSerializer(summary)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def check_links(self, request):
        """Run link health check for user's bookmarks"""
        # Get limit parameter with default of 10
        limit = int(request.data.get('limit', 10))

        # Run check
        results = run_link_health_check(user_id=request.user.id, limit=limit)

        # Count by status
        status_counts = {}
        for result in results:
            if result:
                status = result.status
                status_counts[status] = status_counts.get(status, 0) + 1

        return Response({
            'message': f'Checked {len(results)} links',
            'status_counts': status_counts
        })

    @action(detail=True, methods=['post'])
    def apply_redirect(self, request, pk=None):
        """Apply redirect to update bookmark URL"""
        health = self.get_object()

        # Check if this is actually a redirect
        if health.status != 'redirected' or not health.final_url:
            return Response(
                {'error': 'This link is not redirected or has no final URL'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update the bookmark URL
        repairer = LinkHealthRepair()
        bookmark = repairer.apply_redirect(health.bookmark.id, request.user.id)

        if bookmark:
            return Response({
                'message': 'Successfully updated bookmark URL',
                'old_url': health.bookmark.url,
                'new_url': bookmark.url,
                'bookmark': BookmarkSerializer(bookmark, context={'request': request}).data
            })
        else:
            return Response(
                {'error': 'Failed to update bookmark URL'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def update_url(self, request, pk=None):
        """Manually update a bookmark URL"""
        health = self.get_object()
        new_url = request.data.get('url')

        if not new_url:
            return Response(
                {'error': 'New URL is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update the bookmark URL
        repairer = LinkHealthRepair()
        bookmark = repairer.update_bookmark_url(health.bookmark.id, new_url, request.user.id)

        if bookmark:
            return Response({
                'message': 'Successfully updated bookmark URL',
                'old_url': health.bookmark.url,
                'new_url': bookmark.url,
                'bookmark': BookmarkSerializer(bookmark, context={'request': request}).data
            })
        else:
            return Response(
                {'error': 'Failed to update bookmark URL'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def broken_links_view(self, request):
        """Get or create the Broken Links smart view"""
        try:
            # Check if the view already exists
            broken_links_view = SavedView.objects.get(
                user=request.user,
                name="Broken Links"
            )
        except SavedView.DoesNotExist:
            # Create the view if it doesn't exist
            broken_links = Bookmark.objects.filter(
                user=request.user,
                health__status='broken'
            )

            # Generate a list of bookmark IDs that are broken
            broken_link_ids = [str(b.id) for b in broken_links]

            # Create the view
            broken_links_view = SavedView.objects.create(
                user=request.user,
                name="Broken Links",
                description=f"Links that need attention ({len(broken_link_ids)} found)",
                filters={'broken_link_ids': broken_link_ids},
                icon="alert-triangle",
                is_system=True,
                order=2  # Just below Duplicates in the sidebar
            )

        serializer = SavedViewSerializer(broken_links_view)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def check_health(self, request, bookmark_id=None):
        """Check health for a specific bookmark"""
        try:
            # Get the bookmark
            bookmark = Bookmark.objects.get(id=bookmark_id, user=request.user)

            # Create or get link health record
            try:
                health = LinkHealth.objects.get(bookmark=bookmark)
            except LinkHealth.DoesNotExist:
                health = LinkHealth(bookmark=bookmark, status='pending', last_checked=timezone.now())
                health.save()

            # Run health check
            checker = LinkHealthChecker()
            result = checker.process_bookmark(bookmark)

            # Handle case where process_bookmark returns None
            if result is None:
                # Update existing health record status
                health.status = 'pending'
                health.last_checked = timezone.now()
                health.save()

                return Response({
                    'message': f'Health check initiated for {bookmark.title}',
                    'status': 'pending',
                    'bookmark': BookmarkSerializer(bookmark, context={'request': request}).data
                })

            # If we got a valid result, use it
            return Response({
                'message': f'Health check completed for {bookmark.title}',
                'status': result.status,
                'bookmark': BookmarkSerializer(bookmark, context={'request': request}).data
            })
        except Bookmark.DoesNotExist:
            return Response(
                {'error': 'Bookmark not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Health check error: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to check link health: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
