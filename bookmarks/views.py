from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Q, Count
from django.utils import timezone
from django.conf import settings
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from datetime import timedelta
import hashlib
import logging

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination

from .models import Bookmark, Tag, Collection, BookmarkActivity, SavedView
from .serializers import (
    BookmarkSerializer, TagSerializer, CollectionSerializer,
    BookmarkActivitySerializer, UserSerializer, BookmarkCreateSerializer,
    BookmarkStatsSerializer, SavedViewSerializer, SearchResultSerializer,
    SearchSuggestionSerializer
)
from .utils import enrich_url
from .search import BookmarkSearchEngine, get_search_syntax_help
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
        """Toggle bookmark archive status"""
        bookmark = self.get_object()
        bookmark.is_archived = not bookmark.is_archived
        bookmark.save()

        activity_type = 'archived' if bookmark.is_archived else 'unarchived'
        BookmarkActivity.objects.create(
            bookmark=bookmark,
            user=request.user,
            activity_type=activity_type
        )

        return Response({'is_archived': bookmark.is_archived})

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
        'total_collections': total_collections,
        'total_tags': total_tags,
        'recent_activity_count': recent_activity_count,
        'top_domains': list(top_domains)
    }

    serializer = BookmarkStatsSerializer(stats)
    return Response(serializer.data)
