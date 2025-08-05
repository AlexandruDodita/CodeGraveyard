import requests
import re
import random
import time
import logging
from typing import List, Dict, Optional, Any, Tuple
from bs4 import BeautifulSoup
from .scraper import AmazonScraper

class ReviewAnalyzer:
    """
    A class to extract and analyze Amazon product reviews.
    Builds on the AmazonScraper to specifically handle review data.
    """
    
    def __init__(self, user_agent: str = None):
        """
        Initialize the review analyzer with optional custom user agent.
        
        Args:
            user_agent (str, optional): Custom User-Agent header for HTTP requests.
        """
        self.scraper = AmazonScraper(user_agent)
        self.logger = logging.getLogger(__name__)
    
    def extract_reviews(self, product_url: str, max_pages: int = 3) -> List[Dict[str, Any]]:
        """
        Extract reviews from Amazon product page through direct web scraping.
        
        Args:
            product_url (str): The URL of the Amazon product page.
            max_pages (int): Maximum number of review pages to scrape.
            
        Returns:
            List[Dict[str, Any]]: List of review data dictionaries.
        """
        # First extract the ASIN from the product URL
        asin = self._extract_asin(product_url)
        if not asin:
            self.logger.error(f"Failed to extract ASIN from URL: {product_url}")
            return []
            
        # Review URL formats to try
        review_urls = [
            f"https://www.amazon.com/product-reviews/{asin}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews&sortBy=recent",
            f"https://www.amazon.com/product-reviews/{asin}/?sortBy=recent&pageNumber=1",
            f"https://www.amazon.com/dp/{asin}/reviews"
        ]
        
        all_reviews = []
        
        # Try each review URL format
        for review_url in review_urls:
            self.logger.info(f"Scraping reviews from: {review_url}")
            
            current_page = 1
            while current_page <= max_pages:
                # Replace page number in URL if needed
                page_url = review_url
                if "pageNumber=1" in page_url:
                    page_url = review_url.replace(f"pageNumber=1", f"pageNumber={current_page}")
                
                self.logger.info(f"Fetching review page {current_page}: {page_url}")
                html_content = self.scraper.fetch_page(page_url)
                if not html_content:
                    self.logger.error(f"Failed to fetch review page {current_page}")
                    break
                
                # Parse the current page reviews
                page_reviews = self._parse_review_page(html_content)
                
                if not page_reviews:
                    self.logger.info(f"No reviews found on page {current_page}")
                    break
                    
                all_reviews.extend(page_reviews)
                self.logger.info(f"Extracted {len(page_reviews)} reviews from page {current_page}")
                
                # Check if there's a next page link
                soup = BeautifulSoup(html_content, 'html.parser')
                next_page_link = soup.select_one("li.a-last a") or soup.select_one("a.a-last")
                if not next_page_link:
                    self.logger.info("No next page link found, ending review extraction")
                    break
                    
                current_page += 1
                # Add a delay between page requests
                time.sleep(random.uniform(2.0, 5.0))
            
            # If we found reviews using this URL format, no need to try the other
            if all_reviews:
                break
                
        # If still no reviews, try scraping from the main product page as a last resort
        if not all_reviews:
            self.logger.info(f"Trying to extract reviews from main product page: https://www.amazon.com/dp/{asin}")
            html_content = self.scraper.fetch_page(f"https://www.amazon.com/dp/{asin}")
            if html_content:
                soup = BeautifulSoup(html_content, 'html.parser')
                
                # Try to extract reviews from the product page
                reviews = self._extract_review_snippets(soup)
                if reviews:
                    all_reviews.extend(reviews)
                    self.logger.info(f"Extracted {len(reviews)} review snippets from product page")
        
        self.logger.info(f"Extracted a total of {len(all_reviews)} reviews")
        return all_reviews
    
    def _extract_overall_rating(self, soup) -> float:
        """Extract the overall rating from the product page."""
        rating = 0.0
        try:
            # Try multiple selectors for overall rating
            rating_selectors = [
                "#acrPopover .a-icon-alt",
                "span.reviewCountTextLinkedHistogram",
                "i.a-icon-star .a-icon-alt",
                "#averageCustomerReviews .a-icon-alt",
                "#reviewsMedley .a-color-base"
            ]
            
            for selector in rating_selectors:
                rating_elem = soup.select_one(selector)
                if rating_elem:
                    rating_text = rating_elem.get_text(strip=True)
                    match = re.search(r'([\d.]+)', rating_text)
                    if match:
                        try:
                            rating = float(match.group(1))
                            if 0 < rating <= 5:
                                return rating
                        except ValueError:
                            continue
        except Exception as e:
            self.logger.warning(f"Error extracting overall rating: {str(e)}")
        
        return rating
    
    def _extract_rating_distribution(self, soup, reviews, overall_rating):
        """Extract rating distribution from the histogram if available."""
        try:
            # Try to find the percentage of each star rating
            table = soup.select_one("#histogramTable")
            if table:
                rows = table.select("tr.a-histogram-row")
                
                for row in rows:
                    star_elem = row.select_one(".aok-nowrap")
                    if not star_elem:
                        continue
                        
                    star_text = star_elem.get_text(strip=True)
                    star_match = re.search(r'(\d+)', star_text)
                    if not star_match:
                        continue
                        
                    stars = int(star_match.group(1))
                    
                    # Get percentage
                    pct_elem = row.select_one(".a-text-right")
                    pct_text = pct_elem.get_text(strip=True) if pct_elem else ""
                    pct_match = re.search(r'(\d+)%', pct_text)
                    
                    if pct_match:
                        percentage = int(pct_match.group(1))
                        
                        if percentage > 0:
                            # Create a synthetic review for each star level
                            reviews.append({
                                'reviewer_name': f"{stars} Star Reviews",
                                'title': f"{stars} Star Reviews - {percentage}% of all reviews",
                                'rating': stars,
                                'date': "Rating distribution",
                                'text': f"About {percentage}% of customers gave this product a {stars}-star rating.",
                                'verified_purchase': False,
                                'helpful_votes': 0
                            })
        except Exception as e:
            self.logger.warning(f"Error extracting rating distribution: {str(e)}")
    
    def _extract_asin(self, url: str) -> Optional[str]:
        """Extract the ASIN (Amazon product ID) from a URL."""
        # Try the standard /dp/ pattern
        dp_match = re.search(r'/dp/([A-Z0-9]{10})', url)
        if dp_match:
            return dp_match.group(1)
            
        # Try the product-reviews pattern
        reviews_match = re.search(r'/product-reviews/([A-Z0-9]{10})', url)
        if reviews_match:
            return reviews_match.group(1)
            
        # Try to find it in query parameters
        asin_match = re.search(r'[?&]asin=([A-Z0-9]{10})', url)
        if asin_match:
            return asin_match.group(1)
            
        return None
    
    def _parse_review_page(self, html_content: str) -> List[Dict[str, Any]]:
        """
        Parse a review page to extract individual reviews.
        
        Args:
            html_content (str): HTML content of the review page.
            
        Returns:
            List[Dict[str, Any]]: List of review data dictionaries.
        """
        soup = BeautifulSoup(html_content, 'html.parser')
        reviews = []
        
        # Updated review selectors for current Amazon HTML structure
        review_selectors = [
            "#cm_cr-review_list div.review",
            "div[data-hook='review']",
            "div.review",
            ".review-container",
            ".a-section.review"
        ]
        
        for selector in review_selectors:
            try:
                review_elements = soup.select(selector)
                
                if review_elements:
                    self.logger.info(f"Found {len(review_elements)} reviews using selector: {selector}")
                    
                    for element in review_elements:
                        try:
                            # Extract reviewer information
                            profile_elem = element.select_one(".a-profile-name") or element.select_one("[data-hook='review-author']") or element.select_one(".a-color-secondary .a-profile") or element.select_one(".review-byline")
                            reviewer_name = profile_elem.get_text(strip=True) if profile_elem else "Anonymous"
                            
                            # Extract review title
                            title_selectors = [
                                "[data-hook='review-title']",
                                "a[data-hook='review-title']",
                                ".review-title",
                                ".a-color-base.review-title-content",
                                "span.review-title-content"
                            ]
                            
                            title = ""
                            for title_selector in title_selectors:
                                title_elem = element.select_one(title_selector)
                                if title_elem:
                                    title = title_elem.get_text(strip=True)
                                    if title and (title.startswith("Reviewed in") or "top reviewer" in title.lower()):
                                        # This is not the title but a location info
                                        continue
                                    break
                            
                            # Extract star rating
                            rating_selectors = [
                                "i.review-rating",
                                "[data-hook='review-star-rating']",
                                "[data-hook='cmps-review-star-rating']",
                                "span.a-icon-alt",
                                ".a-star-rating .a-icon-alt"
                            ]
                            
                            rating = 0.0
                            for rating_selector in rating_selectors:
                                rating_elem = element.select_one(rating_selector)
                                if rating_elem:
                                    rating_text = rating_elem.get_text(strip=True)
                                    rating = self._extract_rating(rating_text)
                                    if rating > 0:
                                        break
                            
                            # Extract review date
                            date_selectors = [
                                "[data-hook='review-date']",
                                ".review-date",
                                ".a-color-secondary.review-date"
                            ]
                            
                            review_date = ""
                            for date_selector in date_selectors:
                                date_elem = element.select_one(date_selector)
                                if date_elem:
                                    review_date = date_elem.get_text(strip=True)
                                    break
                            
                            # Extract review content
                            body_selectors = [
                                "[data-hook='review-body']",
                                "span[data-hook='review-body']",
                                ".review-text-content span",
                                ".review-text",
                                ".review-data"
                            ]
                            
                            review_text = ""
                            for body_selector in body_selectors:
                                body_elem = element.select_one(body_selector)
                                if body_elem:
                                    review_text = body_elem.get_text(strip=True)
                                    if review_text:
                                        break
                            
                            # Extract verified purchase status
                            verified_selectors = [
                                "span[data-hook='avp-badge']",
                                ".a-size-mini:contains('Verified Purchase')",
                                ".a-color-success:contains('Verified Purchase')"
                            ]
                            
                            verified = False
                            for verified_selector in verified_selectors:
                                verified_elem = element.select_one(verified_selector)
                                if verified_elem and "verified" in verified_elem.get_text().lower():
                                    verified = True
                                    break
                            
                            # Extract helpfulness votes
                            votes_selectors = [
                                "span[data-hook='helpful-vote-statement']",
                                ".cr-vote-text",
                                ".vote-text",
                                ".helpful-votes-statement"
                            ]
                            
                            helpful_votes = 0
                            for votes_selector in votes_selectors:
                                votes_elem = element.select_one(votes_selector)
                                if votes_elem:
                                    votes_text = votes_elem.get_text(strip=True)
                                    matches = re.search(r'(\d+)', votes_text)
                                    if matches:
                                        helpful_votes = int(matches.group(1))
                                        break
                            
                            # Only add reviews with some content
                            if (title or review_text) and rating > 0:
                                # Create review dictionary
                                review = {
                                    'reviewer_name': reviewer_name,
                                    'title': title,
                                    'rating': rating,
                                    'date': review_date,
                                    'text': review_text,
                                    'verified_purchase': verified,
                                    'helpful_votes': helpful_votes
                                }
                                
                                reviews.append(review)
                            
                        except Exception as e:
                            self.logger.warning(f"Error parsing review: {str(e)}")
                            continue
                    
                    # If we found reviews with this selector, no need to try others
                    if reviews:
                        break
            except Exception as e:
                self.logger.warning(f"Error with review selector {selector}: {str(e)}")
                continue
        
        return reviews
    
    def _extract_rating(self, rating_text: str) -> float:
        """Extract numeric rating from text like '4.0 out of 5 stars'."""
        if not rating_text:
            return 0.0
            
        match = re.search(r'([\d.]+)', rating_text)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        return 0.0
    
    def analyze_sentiment(self, reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Perform basic statistical analysis on reviews and extract top positive and negative reviews.
        
        Args:
            reviews (List[Dict[str, Any]]): List of review dictionaries.
            
        Returns:
            Dict[str, Any]: Analysis results including top reviews.
        """
        if not reviews:
            return {
                'average_rating': 0.0,
                'total_reviews': 0,
                'rating_counts': {},
                'verified_count': 0,
                'verified_percentage': 0.0,
                'top_positive_reviews': [],
                'top_negative_reviews': []
            }
        
        # Calculate average rating
        total_rating = sum(review['rating'] for review in reviews)
        average_rating = total_rating / len(reviews)
        
        # Count ratings by star level
        rating_counts = {}
        for i in range(1, 6):
            count = sum(1 for review in reviews if int(review['rating']) == i)
            rating_counts[f"{i}_star"] = count
            
        # Count verified purchases
        verified_count = sum(1 for review in reviews if review['verified_purchase'])
        verified_percentage = (verified_count / len(reviews)) * 100
        
        # Extract top positive reviews (4-5 stars)
        positive_reviews = [r for r in reviews if r['rating'] >= 4.0]
        # Sort by helpfulness (if available) or most recent
        positive_reviews.sort(key=lambda x: (x.get('helpful_votes', 0), x.get('date', '')), reverse=True)
        top_positive = positive_reviews[:5]  # Get top 5
        
        # Extract top negative reviews (1-2 stars)
        negative_reviews = [r for r in reviews if r['rating'] <= 2.0]
        # Sort by helpfulness (if available) or most recent
        negative_reviews.sort(key=lambda x: (x.get('helpful_votes', 0), x.get('date', '')), reverse=True)
        top_negative = negative_reviews[:5]  # Get top 5
        
        self.logger.info(f"Found {len(positive_reviews)} positive reviews and {len(negative_reviews)} negative reviews")
        self.logger.info(f"Selected top {len(top_positive)} positive and top {len(top_negative)} negative reviews")
        
        return {
            'average_rating': round(average_rating, 2),
            'total_reviews': len(reviews),
            'rating_counts': rating_counts,
            'verified_count': verified_count,
            'verified_percentage': round(verified_percentage, 2),
            'top_positive_reviews': top_positive,
            'top_negative_reviews': top_negative
        }
    
    def find_similar_products(self, product_url: str) -> List[Dict[str, Any]]:
        """
        Find similar products shown on the product page through direct web scraping.
        
        Args:
            product_url (str): URL of the product page.
            
        Returns:
            List[Dict[str, Any]]: List of similar product details.
        """
        self.logger.info(f"Scraping similar products from: {product_url}")
        
        html_content = self.scraper.fetch_page(product_url)
        if not html_content:
            self.logger.error("Failed to fetch product page for similar products")
            return []
        
        soup = BeautifulSoup(html_content, 'html.parser')
        similar_products = []
        
        # Try multiple selectors for similar/related product sections
        similar_selectors = [
            "#sp_detail", 
            "#sims-consolidated-1_feature_div",
            "#sims-consolidated-2_feature_div",
            "#purchase-sims-feature",
            "#session-sims-feature",
            "#similarities_feature_div",
            "#customerAlsoBought_feature_div",
            "#anonCarousel1",
            ".a-carousel-container"
        ]
        
        for selector in similar_selectors:
            similar_section = soup.select_one(selector)
            if not similar_section:
                continue
            
            self.logger.info(f"Found similar products section with selector: {selector}")
            
            # Method 1: Look for items in carousel
            item_elements = similar_section.select(".a-carousel-card") or \
                          similar_section.select(".a-carousel-item") or \
                          similar_section.select(".sims-fbt-item")
            
            if not item_elements:
                # Method 2: Try list format
                item_elements = similar_section.select("li.a-spacing-medium") or \
                              similar_section.select("li.a-carousel-card") or \
                              similar_section.select(".a-list-item")
            
            self.logger.info(f"Found {len(item_elements)} potential similar product elements")
            
            for item in item_elements:
                try:
                    product = self._extract_similar_product_info(item)
                    if product and product not in similar_products:
                        similar_products.append(product)
                except Exception as e:
                    self.logger.warning(f"Error extracting similar product info: {str(e)}")
            
            # If we found products using this selector, no need to try others
            if similar_products:
                break
        
        # If we haven't found products in carousels, try finding sponsored products
        if not similar_products:
            self.logger.info("Trying to find sponsored products")
            sponsored_sections = soup.select("#sp-detail-gridlets") or \
                                soup.select("#sp_detail") or \
                                soup.select("#hero-quick-promo") or \
                                soup.select(".sponsored-products")
            
            for section in sponsored_sections:
                prods = section.select(".a-carousel-card") or \
                       section.select(".sp-grid-product") or \
                       section.select(".sp-product")
                
                for prod in prods:
                    try:
                        product = self._extract_similar_product_info(prod)
                        if product and product not in similar_products:
                            similar_products.append(product)
                    except Exception as e:
                        self.logger.warning(f"Error extracting sponsored product: {str(e)}")
    
        self.logger.info(f"Found {len(similar_products)} similar products")
        return similar_products
        
    def _extract_similar_product_info(self, element) -> Dict[str, Any]:
        """
        Extract product information from a similar product element.
        
        Args:
            element: BeautifulSoup element containing product information
            
        Returns:
            Dict[str, Any]: Product information dictionary
        """
        product = {}
        
        try:
            # Extract title
            title_elem = element.select_one(".a-size-base") or \
                        element.select_one(".a-link-normal .a-text-normal") or \
                        element.select_one(".a-color-base.a-text-normal") or \
                        element.select_one("h2") or \
                        element.select_one("h5") or \
                        element.select_one(".p13n-sc-truncated")
            
            if title_elem:
                product["title"] = title_elem.get_text(strip=True)
            else:
                # If we can't find the title, try to get it from an image alt attribute
                img = element.select_one("img")
                if img and img.get("alt"):
                    product["title"] = img.get("alt").strip()
            
            # If we still don't have a title, skip this product
            if not product.get("title"):
                return {}
            
            # Extract URL
            link_elem = element.select_one("a.a-link-normal") or element.select_one("a")
            if link_elem and link_elem.get("href"):
                href = link_elem["href"]
                if href.startswith("/"):
                    product["url"] = f"https://www.amazon.com{href}"
                else:
                    product["url"] = href
                
                # Extract ASIN from URL if possible
                asin_match = re.search(r'/dp/([A-Z0-9]{10})/', product["url"])
                if asin_match:
                    product["asin"] = asin_match.group(1)
                else:
                    # Try another pattern
                    asin_match = re.search(r'/product/([A-Z0-9]{10})/', product["url"])
                    if asin_match:
                        product["asin"] = asin_match.group(1)
            
            # Extract image URL
            img_elem = element.select_one("img")
            if img_elem:
                product["image_url"] = img_elem.get("src")
                
                # Sometimes Amazon uses data-src for lazy loading
                if not product["image_url"] or product["image_url"].endswith("transparent-pixel.gif"):
                    for attr in ["data-src", "data-a-dynamic-image"]:
                        if img_elem.get(attr):
                            product["image_url"] = img_elem.get(attr)
                            break
            
            # Extract price
            price_elem = element.select_one(".a-color-price") or \
                        element.select_one(".p13n-sc-price") or \
                        element.select_one(".a-price .a-offscreen") or \
                        element.select_one(".a-price")
            
            if price_elem:
                price_text = price_elem.get_text(strip=True)
                product["price"] = price_text
            
            # Extract rating
            rating_elem = element.select_one("i.a-icon-star") or \
                         element.select_one(".a-icon-star")
            
            if rating_elem:
                rating_text = rating_elem.get_text(strip=True)
                rating_match = re.search(r'([\d.]+)', rating_text)
                if rating_match:
                    try:
                        product["rating"] = float(rating_match.group(1))
                    except ValueError:
                        pass
            
            # Extract review count
            reviews_elem = element.select_one(".a-size-small:not(.a-color-price)") or \
                          element.select_one("a.a-link-normal > .a-size-base") or \
                          element.select_one(".a-section.a-spacing-none a:not(.a-link-normal)")
            
            if reviews_elem:
                reviews_text = reviews_elem.get_text(strip=True)
                reviews_match = re.search(r'([\d,]+)', reviews_text)
                if reviews_match:
                    try:
                        product["review_count"] = int(reviews_match.group(1).replace(",", ""))
                    except ValueError:
                        pass
            
            return product
            
        except Exception as e:
            self.logger.warning(f"Error extracting product info: {str(e)}")
            return {}
    
    def _extract_review_snippets(self, soup) -> List[Dict[str, Any]]:
        """
        Extract review snippets/cards from the product page.
        
        Args:
            soup: BeautifulSoup object of the page
            
        Returns:
            List[Dict[str, Any]]: List of review data dictionaries
        """
        reviews = []
        
        # Look for various review snippet containers
        snippet_selectors = [
            ".review-snippet", 
            ".celwidget .review", 
            "#cm-cr-dp-review-list .review",
            "#cm-cr-carousel-review-list .review"
        ]
        
        for selector in snippet_selectors:
            try:
                snippets = soup.select(selector)
                self.logger.info(f"Found {len(snippets)} review snippets with selector: {selector}")
                
                for snippet in snippets:
                    try:
                        # Extract review title
                        title_elem = snippet.select_one(".review-title") or snippet.select_one("[data-hook='review-title']")
                        title = title_elem.get_text(strip=True) if title_elem else ""
                        
                        # Extract rating
                        rating_elem = snippet.select_one("i.review-rating") or snippet.select_one("[data-hook='review-star-rating']")
                        rating = 0.0
                        if rating_elem:
                            rating_text = rating_elem.get_text(strip=True)
                            rating = self._extract_rating(rating_text)
                        
                        # Extract review text
                        text_elem = snippet.select_one(".review-text") or snippet.select_one("[data-hook='review-body']")
                        review_text = text_elem.get_text(strip=True) if text_elem else ""
                        
                        # Extract reviewer name
                        reviewer_elem = snippet.select_one(".a-profile-name") or snippet.select_one("[data-hook='review-author']")
                        reviewer_name = reviewer_elem.get_text(strip=True) if reviewer_elem else "Anonymous"
                        
                        # Extract date
                        date_elem = snippet.select_one(".review-date") or snippet.select_one("[data-hook='review-date']")
                        review_date = date_elem.get_text(strip=True) if date_elem else ""
                        
                        # Only add reviews with some content
                        if (title or review_text) and rating > 0:
                            review = {
                                'reviewer_name': reviewer_name,
                                'title': title,
                                'rating': rating,
                                'date': review_date,
                                'text': review_text,
                                'verified_purchase': False,  # Default for snippets as we can't always determine
                                'helpful_votes': 0  # Default for snippets
                            }
                            reviews.append(review)
                            
                    except Exception as e:
                        self.logger.warning(f"Error parsing review snippet: {str(e)}")
                
                if reviews:
                    break
                    
            except Exception as e:
                self.logger.warning(f"Error with snippet selector {selector}: {str(e)}")
        
        return reviews


def analyze_product_reviews(url: str, max_review_pages: int = 3) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Utility function to analyze reviews for a product.
    
    Args:
        url (str): The URL of the Amazon product page.
        max_review_pages (int): Maximum number of review pages to scrape.
        
    Returns:
        Tuple[List[Dict[str, Any]], Dict[str, Any]]: Tuple containing the list of reviews 
        and the sentiment analysis results.
    """
    analyzer = ReviewAnalyzer()
    reviews = analyzer.extract_reviews(url, max_review_pages)
    analysis = analyzer.analyze_sentiment(reviews)
    return reviews, analysis


# Example usage
if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Example Amazon product URL
    url = "https://www.amazon.com/dp/B00SX2YSMS"
    
    # Create analyzer
    analyzer = ReviewAnalyzer()
    
    # Get reviews
    reviews = analyzer.extract_reviews(url, max_pages=2)
    
    # Analyze sentiment
    analysis = analyzer.analyze_sentiment(reviews)
    
    # Find similar products
    similar_products = analyzer.find_similar_products(url)
    
    # Print results
    print(f"\n{'-'*50}")
    print(f"REVIEW ANALYSIS FOR PRODUCT")
    print(f"{'-'*50}")
    print(f"Total reviews analyzed: {analysis['total_reviews']}")
    print(f"Average rating: {analysis['average_rating']} stars")
    print(f"Rating distribution:")
    for star, count in analysis['rating_counts'].items():
        print(f"  {star}: {count} reviews")
    print(f"Verified purchases: {analysis['verified_count']} ({analysis['verified_percentage']}%)")
    
    print(f"\n{'-'*50}")
    print(f"SAMPLE REVIEWS (showing first 3)")
    print(f"{'-'*50}")
    for i, review in enumerate(reviews[:3]):
        print(f"Review #{i+1}: {review['title']} - {review['rating']} stars")
        print(f"Date: {review['date']} | Verified: {'Yes' if review['verified_purchase'] else 'No'}")
        print(f"Text: {review['text'][:200]}..." if len(review['text']) > 200 else review['text'])
        print()
        
    print(f"{'-'*50}")
    print(f"SIMILAR PRODUCTS (found {len(similar_products)})")
    print(f"{'-'*50}")
    for i, product in enumerate(similar_products[:5]):
        print(f"{i+1}. {product['title']}")
        print(f"   URL: {product['url']}")
        print(f"   Price: {product['price']}")
        print() 