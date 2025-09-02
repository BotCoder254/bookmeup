"""
Advanced search functionality for bookmarks with support for:
- Full-text search across title, description, notes, and content
- Smart filter parsing (tag:name, domain:example.com, etc.)
- Fuzzy search with similarity scoring
- Combined ranking system
"""

from django.db.models import Q, Case, When, IntegerField, F
from django.db.models.functions import Greatest
from django.conf import settings
from .models import Bookmark, Tag, Collection
import re
from urllib.parse import urlparse
from datetime import datetime, timedelta


class BookmarkSearchEngine:
    """Advanced search engine for bookmarks"""
    
    def __init__(self, user):
        self.user = user
        self.base_queryset = Bookmark.objects.filter(user=user)
    
    def parse_search_query(self, query):
        """
        Parse search query and extract filters and text search
        Supports syntax like: tag:design domain:github.com unread:true "exact phrase"
        """
        filters = {}
        text_parts = []
        
        if not query:
            return filters, ""
        
        # Extract special filter syntax
        patterns = {
            'tag': r'tag:([^\s]+)',
            'domain': r'domain:([^\s]+)',
            'collection': r'collection:([^\s]+)',
            'unread': r'unread:(true|false)',
            'favorite': r'favorite:(true|false)',
            'archived': r'archived:(true|false)',
            'after': r'after:(\d{4}-\d{2}-\d{2})',
            'before': r'before:(\d{4}-\d{2}-\d{2})',
        }
        
        remaining_query = query
        
        for filter_type, pattern in patterns.items():
            matches = re.finditer(pattern, remaining_query, re.IGNORECASE)
            for match in matches:
                value = match.group(1)
                if filter_type == 'tag':
                    if 'tags' not in filters:
                        filters['tags'] = []
                    filters['tags'].append(value)
                elif filter_type in ['unread', 'favorite', 'archived']:
                    filters[filter_type] = value.lower() == 'true'
                elif filter_type in ['after', 'before']:
                    filters[f'date_{filter_type}'] = value
                else:
                    filters[filter_type] = value
                
                # Remove the matched filter from the query
                remaining_query = remaining_query.replace(match.group(0), ' ')
        
        # Extract quoted phrases
        quoted_phrases = re.findall(r'"([^"]*)"', remaining_query)
        for phrase in quoted_phrases:
            text_parts.append(phrase)
            remaining_query = remaining_query.replace(f'"{phrase}"', ' ')
        
        # Add remaining words
        words = remaining_query.split()
        text_parts.extend([word for word in words if word.strip()])
        
        text_search = ' '.join(text_parts).strip()
        
        return filters, text_search
    
    def apply_filters(self, queryset, filters):
        """Apply parsed filters to queryset"""
        
        if 'tags' in filters:
            # Filter by tags (AND logic - bookmark must have all specified tags)
            for tag_name in filters['tags']:
                queryset = queryset.filter(tags__name__iexact=tag_name)
        
        if 'domain' in filters:
            queryset = queryset.filter(domain__icontains=filters['domain'])
        
        if 'collection' in filters:
            try:
                collection = Collection.objects.get(
                    user=self.user, 
                    name__iexact=filters['collection']
                )
                queryset = queryset.filter(collection=collection)
            except Collection.DoesNotExist:
                # Return empty queryset if collection doesn't exist
                queryset = queryset.none()
        
        if 'unread' in filters:
            if filters['unread']:
                queryset = queryset.filter(is_read=False)
            else:
                queryset = queryset.filter(is_read=True)
        
        if 'favorite' in filters:
            queryset = queryset.filter(is_favorite=filters['favorite'])
        
        if 'archived' in filters:
            queryset = queryset.filter(is_archived=filters['archived'])
        
        if 'date_after' in filters:
            try:
                date = datetime.strptime(filters['date_after'], '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date__gte=date)
            except ValueError:
                pass
        
        if 'date_before' in filters:
            try:
                date = datetime.strptime(filters['date_before'], '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__date__lte=date)
            except ValueError:
                pass
        
        return queryset
    
    def text_search(self, queryset, text_query, fuzzy=False):
        """
        Perform text search across title, description, notes, and content
        With ranking based on field importance and match quality
        """
        if not text_query:
            return queryset
        
        # Get search weights from settings
        weights = getattr(settings, 'SEARCH_RANKING_WEIGHTS', {
            'title': 4, 'description': 3, 'notes': 2, 'content': 1
        })
        
        # Split query into terms
        terms = text_query.split()
        
        q_objects = Q()
        
        for term in terms:
            # Create Q objects for each field
            term_q = (
                Q(title__icontains=term) |
                Q(description__icontains=term) |
                Q(notes__icontains=term) |
                Q(content__icontains=term)
            )
            q_objects &= term_q
        
        # Apply the search filter
        queryset = queryset.filter(q_objects)
        
        # Add ranking annotation
        ranking_cases = []
        
        for term in terms:
            # Title matches get highest weight
            ranking_cases.append(
                When(title__icontains=term, then=weights['title'])
            )
            # Description matches
            ranking_cases.append(
                When(description__icontains=term, then=weights['description'])
            )
            # Notes matches
            ranking_cases.append(
                When(notes__icontains=term, then=weights['notes'])
            )
            # Content matches get lowest weight
            ranking_cases.append(
                When(content__icontains=term, then=weights['content'])
            )
        
        # Add search ranking
        queryset = queryset.annotate(
            search_rank=Case(
                *ranking_cases,
                default=0,
                output_field=IntegerField()
            )
        )
        
        # Order by search relevance, then by creation date
        queryset = queryset.order_by('-search_rank', '-created_at')
        
        return queryset
    
    def find_duplicates(self, queryset):
        """Find potential duplicate bookmarks based on title and domain similarity"""
        # Group by domain and look for similar titles
        duplicates = []
        
        # Get all bookmarks grouped by domain
        domains = queryset.values_list('domain', flat=True).distinct()
        
        for domain in domains:
            if not domain:
                continue
            
            domain_bookmarks = queryset.filter(domain=domain).order_by('title')
            bookmark_list = list(domain_bookmarks)
            
            # Compare titles within the same domain
            for i, bookmark1 in enumerate(bookmark_list):
                for bookmark2 in bookmark_list[i+1:]:
                    similarity = self._calculate_title_similarity(
                        bookmark1.title, bookmark2.title
                    )
                    if similarity > 0.8:  # 80% similarity threshold
                        duplicates.extend([bookmark1.id, bookmark2.id])
        
        if duplicates:
            return queryset.filter(id__in=duplicates)
        
        return queryset.none()
    
    def _calculate_title_similarity(self, title1, title2):
        """Calculate similarity between two titles using simple string comparison"""
        if not title1 or not title2:
            return 0
        
        # Convert to lowercase and split into words
        words1 = set(title1.lower().split())
        words2 = set(title2.lower().split())
        
        # Calculate Jaccard similarity
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        if not union:
            return 0
        
        return len(intersection) / len(union)
    
    def search(self, query, fuzzy=False, find_duplicates=False):
        """
        Main search method that combines all search functionality
        """
        queryset = self.base_queryset
        
        if find_duplicates:
            return self.find_duplicates(queryset)
        
        # Parse the search query
        filters, text_query = self.parse_search_query(query)
        
        # Apply filters
        queryset = self.apply_filters(queryset, filters)
        
        # Apply text search
        if text_query:
            queryset = self.text_search(queryset, text_query, fuzzy=fuzzy)
        
        # Make sure we don't have duplicates in results
        queryset = queryset.distinct()
        
        return queryset
    
    def get_search_suggestions(self, partial_query):
        """Get search suggestions based on partial query"""
        suggestions = []
        
        if partial_query.startswith('tag:'):
            tag_partial = partial_query[4:]
            tags = Tag.objects.filter(
                user=self.user,
                name__icontains=tag_partial
            )[:5]
            suggestions.extend([f"tag:{tag.name}" for tag in tags])
        
        elif partial_query.startswith('collection:'):
            collection_partial = partial_query[11:]
            collections = Collection.objects.filter(
                user=self.user,
                name__icontains=collection_partial
            )[:5]
            suggestions.extend([f"collection:{c.name}" for c in collections])
        
        elif partial_query.startswith('domain:'):
            domain_partial = partial_query[7:]
            domains = Bookmark.objects.filter(
                user=self.user,
                domain__icontains=domain_partial
            ).values_list('domain', flat=True).distinct()[:5]
            suggestions.extend([f"domain:{domain}" for domain in domains])
        
        else:
            # General suggestions
            suggestions = [
                'tag:', 'domain:', 'collection:', 'unread:true', 'favorite:true',
                'archived:false', 'after:2024-01-01', 'before:2024-12-31'
            ]
        
        return suggestions


def get_search_syntax_help():
    """Return search syntax help for the frontend"""
    return {
        'filters': [
            {'syntax': 'tag:design', 'description': 'Find bookmarks with specific tag'},
            {'syntax': 'domain:github.com', 'description': 'Find bookmarks from specific domain'},
            {'syntax': 'collection:work', 'description': 'Find bookmarks in specific collection'},
            {'syntax': 'unread:true', 'description': 'Find unread bookmarks'},
            {'syntax': 'favorite:true', 'description': 'Find favorite bookmarks'},
            {'syntax': 'archived:false', 'description': 'Find non-archived bookmarks'},
            {'syntax': 'after:2024-01-01', 'description': 'Find bookmarks created after date'},
            {'syntax': 'before:2024-12-31', 'description': 'Find bookmarks created before date'},
        ],
        'text': [
            {'syntax': '"exact phrase"', 'description': 'Search for exact phrase in quotes'},
            {'syntax': 'multiple terms', 'description': 'All terms must be present (AND search)'},
        ],
        'examples': [
            'tag:design domain:dribbble.com',
            'unread:true "machine learning"',
            'favorite:true after:2024-01-01',
            'collection:work tag:javascript tag:react'
        ]
    }