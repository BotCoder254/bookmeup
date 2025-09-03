from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Bookmark, Tag, Collection, BookmarkActivity, SavedView, BoardLayout, BookmarkHighlight, BookmarkNote, BookmarkHistoryEntry


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class TagSerializer(serializers.ModelSerializer):
    bookmark_count = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'color', 'order', 'created_at', 'bookmark_count']
        read_only_fields = ['id', 'slug', 'created_at']

    def get_bookmark_count(self, obj):
        return obj.bookmarks.filter(user=self.context['request'].user).count()

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class CollectionSerializer(serializers.ModelSerializer):
    bookmark_count = serializers.ReadOnlyField()
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = [
            'id', 'name', 'description', 'slug', 'is_public', 'cover_image',
            'cover_image_url', 'order', 'created_at', 'updated_at', 'bookmark_count'
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at']

    def get_cover_image_url(self, obj):
        return obj.get_cover_image()

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class BookmarkSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    tag_names = serializers.ReadOnlyField()
    search_rank = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Bookmark
        fields = [
            'id', 'title', 'url', 'description', 'notes', 'content', 'favicon_url', 'screenshot_url',
            'is_favorite', 'is_archived', 'is_public', 'is_read', 'created_at', 'updated_at',
            'visited_at', 'tags', 'tag_ids', 'collection', 'collection_name',
            'tag_names', 'domain', 'search_rank'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'domain', 'search_rank']

    def create(self, validated_data):
        tag_ids = validated_data.pop('tag_ids', [])
        validated_data['user'] = self.context['request'].user
        bookmark = super().create(validated_data)

        # Set tags
        if tag_ids:
            tags = Tag.objects.filter(id__in=tag_ids, user=bookmark.user)
            bookmark.tags.set(tags)

        return bookmark

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop('tag_ids', None)
        bookmark = super().update(instance, validated_data)

        # Update tags if provided
        if tag_ids is not None:
            tags = Tag.objects.filter(id__in=tag_ids, user=bookmark.user)
            bookmark.tags.set(tags)

        return bookmark


class BookmarkCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for quick bookmark creation"""

    class Meta:
        model = Bookmark
        fields = ['url', 'title', 'description', 'is_favorite', 'collection']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class BookmarkActivitySerializer(serializers.ModelSerializer):
    bookmark_title = serializers.CharField(source='bookmark.title', read_only=True)
    bookmark_url = serializers.CharField(source='bookmark.url', read_only=True)

    class Meta:
        model = BookmarkActivity
        fields = [
            'id', 'bookmark', 'bookmark_title', 'bookmark_url',
            'activity_type', 'timestamp', 'metadata'
        ]
        read_only_fields = ['id', 'timestamp']


class BookmarkStatsSerializer(serializers.Serializer):
    """Serializer for bookmark statistics"""
    total_bookmarks = serializers.IntegerField()
    favorite_bookmarks = serializers.IntegerField()
    archived_bookmarks = serializers.IntegerField()
    total_collections = serializers.IntegerField()
    total_tags = serializers.IntegerField()
    recent_activity_count = serializers.IntegerField()
    top_domains = serializers.ListField()


class SavedViewSerializer(serializers.ModelSerializer):
    """Serializer for saved search views"""
    filter_summary = serializers.ReadOnlyField(source='get_filter_summary')

    class Meta:
        model = SavedView
        fields = [
            'id', 'name', 'icon', 'description', 'filters', 'is_public', 'is_system', 'order',
            'created_at', 'updated_at', 'last_used', 'filter_summary'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class SearchSuggestionSerializer(serializers.Serializer):
    """Serializer for search suggestions"""
    suggestions = serializers.ListField(child=serializers.CharField())
    syntax_help = serializers.DictField()


class SearchResultSerializer(serializers.Serializer):
    """Serializer for search results with metadata"""
    bookmarks = BookmarkSerializer(many=True)
    total_count = serializers.IntegerField()
    search_time = serializers.FloatField()
    filters_applied = serializers.DictField()
    text_query = serializers.CharField()


class BoardLayoutSerializer(serializers.ModelSerializer):
    """Serializer for Visual Bookmark Boards layouts"""
    collection_name = serializers.CharField(source='collection.name', read_only=True)

    class Meta:
        model = BoardLayout
        fields = [
            'id', 'collection', 'collection_name', 'layout_data',
            'created_at', 'updated_at', 'is_active', 'version'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'version']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class BookmarkNoteSerializer(serializers.ModelSerializer):
    """Serializer for bookmark notes"""

    class Meta:
        model = BookmarkNote
        fields = [
            'id', 'bookmark', 'content', 'plain_text',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class BookmarkHighlightSerializer(serializers.ModelSerializer):
    """Serializer for bookmark highlights/annotations"""

    class Meta:
        model = BookmarkHighlight
        fields = [
            'id', 'bookmark', 'text', 'note', 'color', 'position_data',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class BookmarkHistoryEntrySerializer(serializers.ModelSerializer):
    """Serializer for browser history entries"""
    bookmark_title = serializers.CharField(source='bookmark.title', read_only=True)
    bookmark_url = serializers.CharField(source='bookmark.url', read_only=True)
    bookmark_favicon = serializers.CharField(source='bookmark.favicon_url', read_only=True)

    class Meta:
        model = BookmarkHistoryEntry
        fields = [
            'id', 'bookmark', 'bookmark_title', 'bookmark_url', 'bookmark_favicon',
            'visited_at', 'referrer', 'device_info'
        ]
        read_only_fields = ['id', 'visited_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
