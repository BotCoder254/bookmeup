import requests
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class URLEnricher:
    """Utility class for enriching URLs with metadata"""

    def __init__(self):
        self.timeout = getattr(settings, 'URL_FETCH_TIMEOUT', 10)
        self.max_content_length = getattr(settings, 'MAX_CONTENT_LENGTH', 1024 * 1024)
        self.allowed_content_types = getattr(settings, 'ALLOWED_CONTENT_TYPES', ['text/html'])
        self.blocked_domains = getattr(settings, 'BLOCKED_DOMAINS', [])

    def is_url_allowed(self, url):
        """Check if URL is allowed to be fetched"""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()

            # Check blocked domains
            if any(blocked in domain for blocked in self.blocked_domains):
                return False

            # Must be HTTP or HTTPS
            if parsed.scheme not in ['http', 'https']:
                return False

            return True
        except Exception:
            return False

    def normalize_url(self, url):
        """Normalize URL for deduplication"""
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        try:
            parsed = urlparse(url)

            # Normalize domain (case insensitive, remove www)
            domain = parsed.netloc.lower()
            if domain.startswith('www.'):
                domain = domain[4:]

            # Normalize path (lowercase, remove duplicate slashes)
            path = parsed.path
            while '//' in path:
                path = path.replace('//', '/')

            # Remove trailing slash unless it's the root
            if path.endswith('/') and path != '/':
                path = path[:-1]

            # Parse query params properly
            from urllib.parse import parse_qs, urlencode

            # Remove common tracking parameters and sort remaining parameters
            if parsed.query:
                # Parse the query string to get a dictionary
                query_dict = parse_qs(parsed.query)

                # Define tracking parameters to remove
                tracking_params = {
                    # UTM parameters
                    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                    # Social media trackers
                    'fbclid', 'gclid', 'ocid', 'dclid',
                    # Common referrer parameters
                    'ref', 'source', 'referrer', 'referral',
                    # Others
                    '_ga', '_gl', 'mc_cid', 'mc_eid',
                    # Session and tracking IDs
                    'session_id', 'tracking_id', 'click_id',
                    # Duplicate bookmark parameter
                    '_dup'
                }

                # Remove tracking parameters
                clean_query = {k: v for k, v in query_dict.items() if k.lower() not in tracking_params}

                # Convert back to query string with sorted parameters
                query_string = urlencode(clean_query, doseq=True)
            else:
                query_string = ""

            # Normalize fragment (remove if empty)
            fragment = parsed.fragment if parsed.fragment else ""

            # Rebuild URL
            normalized = f"{parsed.scheme}://{domain}{path}"
            if query_string:
                normalized += f"?{query_string}"
            if fragment:
                normalized += f"#{fragment}"

            return normalized
        except Exception:
            return url

    def fetch_page_metadata(self, url):
        """Fetch and extract metadata from a URL"""
        if not self.is_url_allowed(url):
            raise ValueError("URL is not allowed")

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }

        try:
            # Make request with redirects
            response = requests.get(
                url,
                headers=headers,
                timeout=self.timeout,
                allow_redirects=True,
                stream=True
            )
            response.raise_for_status()

            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            if not any(allowed in content_type for allowed in self.allowed_content_types):
                raise ValueError(f"Content type not allowed: {content_type}")

            # Check content length
            content_length = response.headers.get('content-length')
            if content_length and int(content_length) > self.max_content_length:
                raise ValueError("Content too large")

            # Read content with size limit
            content = ""
            size = 0
            for chunk in response.iter_content(chunk_size=8192, decode_unicode=True):
                if chunk:
                    size += len(chunk.encode('utf-8'))
                    if size > self.max_content_length:
                        break
                    content += chunk

            # Parse with BeautifulSoup
            soup = BeautifulSoup(content, 'html.parser')

            # Extract metadata
            metadata = self.extract_metadata(soup, response.url)
            metadata['final_url'] = response.url
            metadata['normalized_url'] = self.normalize_url(response.url)

            return metadata

        except requests.RequestException as e:
            logger.error(f"Error fetching URL {url}: {str(e)}")
            raise ValueError(f"Failed to fetch URL: {str(e)}")
        except Exception as e:
            logger.error(f"Error processing URL {url}: {str(e)}")
            raise ValueError(f"Failed to process URL: {str(e)}")

    def extract_metadata(self, soup, url):
        """Extract metadata from BeautifulSoup object"""
        metadata = {
            'title': '',
            'description': '',
            'favicon_url': '',
            'image_url': '',
            'site_name': '',
            'domain': urlparse(url).netloc
        }

        # Extract title
        title_tag = soup.find('title')
        if title_tag:
            metadata['title'] = title_tag.get_text().strip()

        # Try Open Graph title
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            metadata['title'] = og_title['content'].strip()

        # Try Twitter title
        twitter_title = soup.find('meta', attrs={'name': 'twitter:title'})
        if twitter_title and twitter_title.get('content'):
            metadata['title'] = twitter_title['content'].strip()

        # Extract description
        desc_meta = soup.find('meta', attrs={'name': 'description'})
        if desc_meta and desc_meta.get('content'):
            metadata['description'] = desc_meta['content'].strip()

        # Try Open Graph description
        og_desc = soup.find('meta', property='og:description')
        if og_desc and og_desc.get('content'):
            metadata['description'] = og_desc['content'].strip()

        # Try Twitter description
        twitter_desc = soup.find('meta', attrs={'name': 'twitter:description'})
        if twitter_desc and twitter_desc.get('content'):
            metadata['description'] = twitter_desc['content'].strip()

        # Extract favicon
        favicon_links = soup.find_all('link', rel=lambda x: x and 'icon' in x.lower())
        if favicon_links:
            favicon_href = favicon_links[0].get('href')
            if favicon_href:
                metadata['favicon_url'] = urljoin(url, favicon_href)
        else:
            # Default favicon location
            metadata['favicon_url'] = urljoin(url, '/favicon.ico')

        # Extract Open Graph image
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            metadata['image_url'] = urljoin(url, og_image['content'])

        # Try Twitter image
        twitter_image = soup.find('meta', attrs={'name': 'twitter:image'})
        if twitter_image and twitter_image.get('content'):
            metadata['image_url'] = urljoin(url, twitter_image['content'])

        # Extract site name
        og_site_name = soup.find('meta', property='og:site_name')
        if og_site_name and og_site_name.get('content'):
            metadata['site_name'] = og_site_name['content'].strip()

        # Clean up text fields
        for key in ['title', 'description', 'site_name']:
            if metadata[key]:
                # Remove extra whitespace and line breaks
                metadata[key] = re.sub(r'\s+', ' ', metadata[key]).strip()
                # Limit length
                if len(metadata[key]) > 200:
                    metadata[key] = metadata[key][:197] + '...'

        return metadata


def enrich_url(url):
    """Convenience function to enrich a single URL"""
    enricher = URLEnricher()
    return enricher.fetch_page_metadata(url)

def normalize_url(url):
    """Convenience function to normalize a URL"""
    enricher = URLEnricher()
    return enricher.normalize_url(url)

def is_duplicate_url(url):
    """Check if a URL is a duplicate (contains _dup parameter)"""
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    return '_dup' in query_params

def calculate_text_similarity(text1, text2):
    """Calculate similarity between two text strings using character trigrams"""
    if not text1 or not text2:
        return 0.0

    # Convert to lowercase and remove extra whitespace
    text1 = ' '.join(text1.lower().split())
    text2 = ' '.join(text2.lower().split())

    # Generate trigrams for both texts
    def get_trigrams(text):
        trigrams = set()
        text = text.strip()
        if len(text) < 3:
            return trigrams
        for i in range(len(text) - 2):
            trigrams.add(text[i:i+3])
        return trigrams

    trigrams1 = get_trigrams(text1)
    trigrams2 = get_trigrams(text2)

    # Calculate Jaccard similarity
    if not trigrams1 or not trigrams2:
        return 0.0

    intersection = len(trigrams1.intersection(trigrams2))
    union = len(trigrams1.union(trigrams2))

    return intersection / union if union > 0 else 0.0
